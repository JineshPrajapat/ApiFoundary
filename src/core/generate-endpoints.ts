import type { ParsedEndpoint } from './parse-paths.ts';
import type { HttpAdapter, ApiResponse } from './http-types.ts';

function prefixType(
  type: string,
  schemaNames: Set<string>,
): string {
  if (!type) return type;

  const trimmed = type.trim();

  // Inline object
  if (trimmed.startsWith('{')) return trimmed;

  // Handle unions/intersections
  if (trimmed.includes('|') || trimmed.includes('&')) {
    return trimmed
      .split(/(\||&)/)
      .map(part => {
        const t = part.trim();
        if (t === '|' || t === '&') return part;
        return prefixType(t, schemaNames);
      })
      .join('');
  }

  // Handle arrays
  if (trimmed.endsWith('[]')) {
    const base = trimmed.slice(0, -2);
    return `${prefixType(base, schemaNames)}[]`;
  }

  // Only prefix if it is an actual schema name
  if (schemaNames.has(trimmed)) {
    return `Types.${trimmed}`;
  }

  return trimmed;
}

export function generateEndpoints(
  endpoints: ParsedEndpoint[],
  schemaNames: string[],
): string {
  const schemaSet = new Set(schemaNames);

  return endpoints
    .map(endpoint => {
      const params: string[] = [];

      endpoint.pathParams.forEach(p =>
        params.push(
          `${p.name}: ${prefixType(p.type, schemaSet)}`,
        ),
      );

      if (endpoint.requestBodyType) {
        params.push(
          `data: ${prefixType(
            endpoint.requestBodyType,
            schemaSet,
          )}`,
        );
      }

      if (endpoint.queryParams.length > 0) {
        const queryShape = endpoint.queryParams
          .map(
            q =>
              `${q.name}${q.required ? '' : '?'}: ${prefixType(
                q.type,
                schemaSet,
              )}`,
          )
          .join('; ');

        const hasRequired = endpoint.queryParams.some(
          q => q.required,
        );

        params.push(
          `query${hasRequired ? '' : '?'}: { ${queryShape} }`,
        );
      }

      let interpolated = endpoint.path;
      endpoint.pathParams.forEach(p => {
        interpolated = interpolated.replace(
          `{${p.name}}`,
          `\${${p.name}}`,
        );
      });

      const bodyArg = endpoint.requestBodyType
        ? ', body: data'
        : '';
      const queryArg =
        endpoint.queryParams.length > 0 ? ', query' : '';

      return `
export const ${endpoint.name} = (${params.join(
        ', ',
      )}): Promise<ApiResponse<${prefixType(
        endpoint.responseType,
        schemaSet,
      )}>> =>
  request({
    method: "${endpoint.method}",
    url: \`${interpolated}\`${bodyArg}${queryArg}
  });
`;
    })
    .join('\n');
}