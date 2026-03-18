import type { OpenAPIV3 } from 'openapi-types';
import type { ParsedEndpoint, HttpMethod } from '../../types/openapi.ts';
import { resolveSchema } from './schema-resolver.ts';
import {
  tagToSegments,
  segmentsToPascalPrefix,
  extractAction,
  sanitiseIdentifier,
} from '../utils/identifier.ts';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

export function parsePaths(
  spec: OpenAPIV3.Document,
  onWarning: (msg: string) => void = () => {},
): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  // Deduplication registry: tracks emitted names per tag.
  // Two collision types exist in real-world NestJS specs:
  //
  // A. Cross-tag: same operationId in different tags (different controller, same method name)
  //    Fix: prefix with PascalTag -> Auth_loginUser vs ManagerAuth_loginUser
  //
  // B. Within-tag: same operationId on different paths (spec authoring bug)
  //    Fix: fall back to path-derived name, emit warning
  const seenNamesPerTag = new Map<string, Set<string>>();

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      endpoints.push(
        parseOperation(path, method, operation, pathItem, spec.components, seenNamesPerTag, onWarning),
      );
    }
  }

  return endpoints;
}

function parseOperation(
  path: string,
  method: (typeof HTTP_METHODS)[number],
  operation: OpenAPIV3.OperationObject,
  pathItem: OpenAPIV3.PathItemObject,
  components: OpenAPIV3.ComponentsObject | undefined,
  seenNamesPerTag: Map<string, Set<string>>,
  onWarning: (msg: string) => void,
): ParsedEndpoint {

  // ── Tag ──────────────────────────────────────────────────────────────────
  const rawTag =
    operation.tags?.[0] ??
    path.split('/').filter(Boolean).slice(0, 2).join('/') ??
    'general';

  // tagToSegments handles ALL normalisation:
  //   'default'     -> ['general']      (reserved word remapped)
  //   'ping-server' -> ['pingServer']   (dash -> camelCase)
  //   'manager/auth'-> ['manager','auth']
  const tagSegments = tagToSegments(rawTag);
  const tag = tagSegments.join('/');

  // ── Function name ────────────────────────────────────────────────────────
  //
  // Strategy: PascalTagPrefix + _ + action
  //
  // NestJS operationIds: {ControllerClass}_{actionMethod}
  //   'FeesGroupController_updateFeesGroupSettings'
  //
  // The controller class name is stripped (redundant, already in tag).
  // Only the action is kept:
  //   tag=admin/feesgroup  action=updateFeesGroupSettings
  //   -> AdminFeesgroup_updateFeesGroupSettings
  //
  //   tag=auth             action=loginUser
  //   -> Auth_loginUser
  //
  //   tag=manager/auth     action=managerLogin
  //   -> ManagerAuth_managerLogin

  const rawOperationId = operation.operationId ?? deriveNameFromPath(method, path);
  const action = extractAction(rawOperationId);
  const tagPrefix = segmentsToPascalPrefix(tagSegments);
  let candidateName = sanitiseIdentifier(`${tagPrefix}_${action}`);

  // Within-tag deduplication (Problem B)
  if (!seenNamesPerTag.has(tag)) seenNamesPerTag.set(tag, new Set());
  const seenInTag = seenNamesPerTag.get(tag)!;

  if (seenInTag.has(candidateName)) {
    const fallback = sanitiseIdentifier(`${tagPrefix}_${deriveNameFromPath(method, path)}`);
    onWarning(
      `Duplicate name "${candidateName}" in tag "${tag}" for ${method.toUpperCase()} ${path}. ` +
      `Using path-derived fallback "${fallback}".`,
    );
    candidateName = fallback;
  }

  seenInTag.add(candidateName);

  // ── Parameters ───────────────────────────────────────────────────────────
  const allParams = [
    ...(pathItem.parameters ?? []),
    ...(operation.parameters ?? []),
  ];

  const pathParams: ParsedEndpoint['pathParams'] = [];
  const queryParams: ParsedEndpoint['queryParams'] = [];

  for (const param of allParams) {
    const resolved = resolveParam(param, components);
    if (!resolved) continue;

    const type = resolveSchema(resolved.schema as OpenAPIV3.SchemaObject, components);

    if (resolved.in === 'path') {
      pathParams.push({ name: resolved.name, type });
    }
    if (resolved.in === 'query') {
      queryParams.push({ name: resolved.name, type, required: !!resolved.required });
    }
  }

  for (const p of pathParams) {
    if (!path.includes(`{${p.name}}`)) {
      onWarning(
        `Path param "${p.name}" declared for ${method.toUpperCase()} ${path} but not found in path string.`,
      );
    }
  }

  const responseType = resolveResponse(operation.responses, components);

  if (responseType === 'any') {
    onWarning(`No 200/201 response schema for ${method.toUpperCase()} ${path}. Using "any".`);
  }

  const requestBodyType = resolveRequestBody(operation.requestBody, components);

  return {
    name: candidateName,
    method: method.toUpperCase() as HttpMethod,
    path,
    tag,
    ...(requestBodyType !== undefined ? { requestBodyType } : {}),
    responseType,
    pathParams,
    queryParams,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolveParam(
  param: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject,
  components?: OpenAPIV3.ComponentsObject,
): OpenAPIV3.ParameterObject | undefined {
  if (!('$ref' in param)) return param;
  const refName = param.$ref.split('/').pop()!;
  return components?.parameters?.[refName] as OpenAPIV3.ParameterObject | undefined;
}

function resolveRequestBody(
  body: OpenAPIV3.OperationObject['requestBody'],
  components?: OpenAPIV3.ComponentsObject,
): string | undefined {
  if (!body) return undefined;
  if ('$ref' in body) return body.$ref.split('/').pop();
  const schema = body.content?.['application/json']?.schema;
  return schema ? resolveSchema(schema, components) : undefined;
}

function resolveResponse(
  responses: OpenAPIV3.ResponsesObject | undefined,
  components?: OpenAPIV3.ComponentsObject,
): string {
  if (!responses) return 'any';
  const success = responses['200'] ?? responses['201'];
  if (!success) return 'any';
  if ('$ref' in success) return success.$ref.split('/').pop() ?? 'any';
  const schema = success.content?.['application/json']?.schema;
  return schema ? resolveSchema(schema, components) : 'any';
}

/**
 * Derives a unique function name from HTTP method + URL path.
 * Used as fallback when operationId is absent or collides within a tag.
 *
 *   GET /admin/feesgroup/getSettings/{id} -> getAdminFeesGroupGetSettingsByid
 */
function deriveNameFromPath(method: string, path: string): string {
  const withParams = path.replace(/\{(\w+)\}/g, 'By_$1');
  const parts = withParams.replace(/[^a-zA-Z0-9_/]/g, '_').split('/').filter(Boolean);
  return method.toLowerCase() + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}