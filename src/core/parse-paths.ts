import { OpenAPIV3 } from 'openapi-types';
import { resolveSchema } from './resolve-schema.ts';

export interface ParsedEndpoint {
  name: string;
  method: string;
  path: string;
  tag: string;
  requestBodyType?: string;
  responseType: string;
  pathParams: { name: string; type: string }[];
  queryParams: { name: string; type: string; required: boolean }[];
}

export function parsePaths(spec: OpenAPIV3.Document): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue;

    const commonParams = pathItem.parameters || [];

    for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;

      const name =
        operation.operationId ||
        generateOperationId(method, path);

      const tag =
        operation.tags?.[0] ||
        path.split('/')[1] ||
        'default';

      const allParams = [...commonParams, ...(operation.parameters || [])];

      const pathParams: any[] = [];
      const queryParams: any[] = [];

      for (const param of allParams) {
        let resolvedParam: OpenAPIV3.ParameterObject;

        if ('$ref' in param) {
          const refName = param.$ref.split('/').pop();
          resolvedParam =
            spec.components?.parameters?.[refName!] as any;
        } else {
          resolvedParam = param;
        }

        const type = resolveSchema(
          resolvedParam.schema as any,
          spec.components,
        );

        if (resolvedParam.in === 'path') {
          pathParams.push({
            name: resolvedParam.name,
            type,
          });
        }

        if (resolvedParam.in === 'query') {
          queryParams.push({
            name: resolvedParam.name,
            type,
            required: !!resolvedParam.required,
          });
        }
      }

      // Request Body
      let requestBodyType: string | undefined;

      if (operation.requestBody) {
        if ('$ref' in operation.requestBody) {
          requestBodyType =
            operation.requestBody.$ref.split('/').pop();
        } else {
          const schema =
            operation.requestBody.content?.['application/json']?.schema;
          if (schema) {
            requestBodyType = resolveSchema(schema, spec.components);
          }
        }
      }

      // Response
      let responseType = 'any';
      const success =
        operation.responses?.['200'] ||
        operation.responses?.['201'];

      if (success) {
        if ('$ref' in success) {
          responseType =
            success.$ref.split('/').pop() || 'any';
        } else {
          const schema =
            success.content?.['application/json']?.schema;
          if (schema) {
            responseType = resolveSchema(schema, spec.components);
          }
        }
      }

      endpoints.push({
        name,
        method: method.toUpperCase(),
        path,
        tag,
        requestBodyType,
        responseType,
        pathParams,
        queryParams,
      });
    }
  }

  return endpoints;
}

function generateOperationId(method: string, path: string) {
  return (
    method +
    path
      .replace(/[{}]/g, '')
      .split('/')
      .filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
  );
}