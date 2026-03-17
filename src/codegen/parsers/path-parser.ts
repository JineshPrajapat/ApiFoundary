import type { OpenAPIV3 } from 'openapi-types';
import type { ParsedEndpoint, HttpMethod } from '../../types/openapi.ts';
import { resolveSchema } from './schema-resolver.ts';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

export function parsePaths(
  spec: OpenAPIV3.Document,
  onWarning: (msg: string) => void = () => {},
): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      endpoints.push(
        parseOperation(
          path,
          method,
          operation,
          pathItem,
          spec.components,
          onWarning,
        ),
      );
    }
  }

  return endpoints;
}

function parseOperation(
  path: string,
  method: typeof HTTP_METHODS[number],
  operation: OpenAPIV3.OperationObject,
  pathItem: OpenAPIV3.PathItemObject,
  components?: OpenAPIV3.ComponentsObject,
  onWarning: (msg: string) => void = () => {},
): ParsedEndpoint {
  // ─────────────────────────────────────────────
  // 1️⃣ Endpoint Name
  // ─────────────────────────────────────────────

  const rawOperationName =
    operation.operationId ?? deriveOperationId(method, path);

  const name = sanitiseIdentifier(rawOperationName);

  // ─────────────────────────────────────────────
  // 2️⃣ Tag → Folder Structure Only
  // ─────────────────────────────────────────────

  const rawTag =
    operation.tags?.[0] ??
    path.split('/').filter(Boolean).slice(0, 2).join('/') ??
    'default';

  const tagSegments = tagToSegments(rawTag);
  const tag = tagSegments.join('/');

  // ─────────────────────────────────────────────
  // 3️⃣ Params
  // ─────────────────────────────────────────────

  const allParams = [
    ...(pathItem.parameters ?? []),
    ...(operation.parameters ?? []),
  ];

  const pathParams: ParsedEndpoint['pathParams'] = [];
  const queryParams: ParsedEndpoint['queryParams'] = [];

  for (const param of allParams) {
    const resolved = resolveParam(param, components);
    if (!resolved) continue;

    const type = resolveSchema(
      resolved.schema as OpenAPIV3.SchemaObject,
      components,
    );

    if (resolved.in === 'path')
      pathParams.push({ name: resolved.name, type });

    if (resolved.in === 'query')
      queryParams.push({
        name: resolved.name,
        type,
        required: !!resolved.required,
      });
  }

  // Validate path params
  for (const p of pathParams) {
    if (!path.includes(`{${p.name}}`)) {
      onWarning(
        `Path param "${p.name}" declared for ${method.toUpperCase()} ${path} but not found in path string.`,
      );
    }
  }

  const responseType = resolveResponse(operation.responses, components);

  if (responseType === 'any') {
    onWarning(
      `No 200/201 response schema for ${method.toUpperCase()} ${path}. Response type set to "any".`,
    );
  }

  return {
    name,
    method: method.toUpperCase() as HttpMethod,
    path,
    tag,
    requestBodyType: resolveRequestBody(operation.requestBody, components),
    responseType,
    pathParams,
    queryParams,
  };
}

/* ───────────────────────────────────────────── */
/* Helpers */
/* ───────────────────────────────────────────── */

function resolveParam(
  param: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject,
  components?: OpenAPIV3.ComponentsObject,
): OpenAPIV3.ParameterObject | undefined {
  if (!('$ref' in param)) return param;
  const name = param.$ref.split('/').pop()!;
  return components?.parameters?.[name] as OpenAPIV3.ParameterObject;
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

  if ('$ref' in success)
    return success.$ref.split('/').pop() ?? 'any';

  const schema = success.content?.['application/json']?.schema;

  return schema ? resolveSchema(schema, components) : 'any';
}

function deriveOperationId(method: string, path: string): string {
  const parts = path
    .replace(/[{}]/g, '')
    .split('/')
    .filter(Boolean);

  return (
    method +
    parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('')
  );
}

function sanitiseIdentifier(raw: string): string {
  let id = raw.replace(/[-\s.]+(.)/g, (_, c: string) =>
    c.toUpperCase(),
  );

  id = id.replace(/[^a-zA-Z0-9_$]/g, '_');

  if (/^\d/.test(id)) id = `_${id}`;

  return id;
}

export function tagToSegments(tag: string): string[] {
  return tag
    .split('/')
    .map((seg) =>
      seg
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean);
}