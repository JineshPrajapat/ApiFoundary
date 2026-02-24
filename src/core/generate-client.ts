import type { ParsedEndpoint } from './parse-paths.ts';
import type { HttpAdapter } from './http-types.ts';

export function generateClientFactory(
  endpoints: ParsedEndpoint[],
  schemaNames: string[],
  splitByTag: boolean = true,
): string {
  const tags = Array.from(new Set(endpoints.map(e => e.tag)));

  let imports = '';
  if (splitByTag) {
    imports = tags.map(tag => {
      const tagEndpoints = endpoints.filter(e => e.tag === tag);
      const endpointNames = tagEndpoints.map(e => e.name);
      return `import { ${endpointNames.join(', ')} } from './${tag}';`;
    }).join('\n');
  } else {
    const endpointNames = endpoints.map(e => e.name);
    imports = `import { ${endpointNames.join(', ')} } from './endpoints';`;
  }

  const clientInterface = `
export interface ApiClient {
${tags.map(tag => `  ${tag}: {
${endpoints.filter(e => e.tag === tag).map(e => `    ${e.name}: typeof ${e.name};`).join('\n')}
  };`).join('\n')}
}`;

  const factoryFunction = `
export function createApiClient(http: HttpAdapter): ApiClient {
  return {
${tags.map(tag => `    ${tag}: {
${endpoints.filter(e => e.tag === tag).map(e => `      ${e.name}: ${e.name}.bind(null, http),`).join('\n')}
    },`).join('\n')}
  };
}`;

  return `
import type { HttpAdapter } from './http-types';
${imports}

${clientInterface}

${factoryFunction}
`;
}