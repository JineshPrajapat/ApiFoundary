// import { Command } from 'commander';
// import { loadOpenAPI } from './core/load-openapi.ts';
// import { parseSchemas } from './core/parse-schemas.ts';
// import { parsePaths } from './core/parse-paths.ts';
// import { generateTypes } from './core/generate-types.ts';
// import { generateEndpoints } from './core/generate-endpoints.ts';
// import { writeFiles } from './core/write-files.ts';
// import { fetchTemplate } from './http/fetch-template.ts';
// import { axiosTemplate } from './http/axios-template.ts';

// const program = new Command();

// program
//   .name('typed-openapi-sdk')
//   .description('Generate a typed TypeScript SDK from an OpenAPI 3.x spec')
//   .version('1.0.0');

// program
//   .command('generate')
//   .description('Generate the SDK')
//   .requiredOption('--input <path>', 'URL or local file path to OpenAPI spec')
//   .requiredOption('--output <directory>', 'Output directory for the generated SDK')
//   .option('--http <type>', 'HTTP client to use (fetch or axios)', 'fetch')
//   .option('--split-by-tag <boolean>', 'Split endpoints into files by tag', 'true')
//   .option('--base-url <url>', 'Default base URL for the API', '')
//   .option('--timeout <ms>', 'Default timeout in milliseconds', '30000')
//   .option('--retries <count>', 'Default retry count', '0')
//   .action(async (options) => {
//     try {
//       console.log('🚀 Loading OpenAPI spec...');
//       const spec = await loadOpenAPI(options.input);

//       console.log('📦 Parsing schemas...');
//       const schemas = parseSchemas(spec);
//       const typesContent = generateTypes(schemas);

//       console.log('🛣️ Parsing paths...');
//       const endpoints = parsePaths(spec);

//       const files: Record<string, string> = {};
//       const splitByTag = options.splitByTag === 'true';

//       // Core request client
//       let requestTemplate = options.http === 'axios' ? axiosTemplate : fetchTemplate;
      
//       // Inject default config if provided
//       if (options.baseUrl || options.timeout !== '30000' || options.retries !== '0') {
//         const configUpdates: string[] = [];
//         if (options.baseUrl) configUpdates.push(`baseUrl: '${options.baseUrl}'`);
//         if (options.timeout !== '30000') configUpdates.push(`timeout: ${options.timeout}`);
//         if (options.retries !== '0') configUpdates.push(`retries: ${options.retries}`);
        
//         requestTemplate += `\nsetConfig({ ${configUpdates.join(', ')} });\n`;
//       }

//       files['core/request.ts'] = requestTemplate;

//       // Types file
//       files['types.ts'] = typesContent;

//       const prefixTypes = (content: string) => {
//         // Regex to find types that should be prefixed with Types.
//         // Excludes built-in types like Promise, string, number, boolean, void, any, Record, Array, null
//         const builtIns = ['Promise', 'string', 'number', 'boolean', 'void', 'any', 'Record', 'Array', 'null', 'undefined', 'unknown'];
//         const regex = /: ([A-Z][a-zA-Z0-9]*)/g;
//         return content.replace(regex, (match, type) => {
//           if (builtIns.includes(type)) return match;
//           return `: Types.${type}`;
//         });
//       };

//       if (splitByTag) {
//         const tags = Array.from(new Set(endpoints.map(e => e.tag)));
//         for (const tag of tags) {
//           const tagEndpoints = endpoints.filter(e => e.tag === tag);
//           const endpointContent = generateEndpoints(tagEndpoints);
//           files[`${tag}.ts`] = `
// import { request } from './core/request';
// import * as Types from './types';

// ${prefixTypes(endpointContent)}
//           `;
//         }

//         // Index file
//         files['index.ts'] = tags.map(tag => `export * from './${tag}';`).join('\n') + `\nexport * from './types';\nexport { setConfig } from './core/request';`;
//       } else {
//         const endpointContent = generateEndpoints(endpoints);
//         files['index.ts'] = `
// import { request, setConfig } from './core/request';
// export * from './types';
// export { setConfig };

// ${endpointContent}
//         `;
//       }

//       console.log('💾 Writing files...');
//       await writeFiles(options.output, files);

//       console.log('✅ SDK generated successfully at:', options.output);
//     } catch (error: any) {
//       console.error('❌ Error:', error.message);
//       process.exit(1);
//     }
//   });

// program.parse(process.argv);


import { Command } from 'commander';
import path from 'path';
import { loadOpenAPI } from './core/load-openapi.ts';
import { parseSchemas } from './core/parse-schemas.ts';
import { parsePaths } from './core/parse-paths.ts';
import { generateTypes } from './core/generate-types.ts';
import { generateEndpoints } from './core/generate-endpoints.ts';
import { generateClientFactory } from './core/generate-client.ts';
import { writeFiles } from './core/write-files.ts';

const program = new Command();

program
  .name('apifoundry')
  .description('Generate a fully typed TypeScript SDK from OpenAPI 3.x')
  .version('1.0.0');

program
  .command('generate')
  .requiredOption('--input <path>', 'URL or local OpenAPI spec')
  .requiredOption('--output <directory>', 'Output directory')
  .option('--split-by-tag <boolean>', 'Split files by tag', 'true')
  .action(async (options) => {
    try {
      console.log('🚀 Loading OpenAPI spec...');
      const spec = await loadOpenAPI(options.input);

      console.log('📦 Parsing schemas...');
      const schemas = parseSchemas(spec);
      const typesContent = generateTypes(schemas);
      const schemaNames = schemas.map(s => s.name);

      console.log('🛣️ Parsing paths...');
      const endpoints = parsePaths(spec);

      const files: Record<string, string> = {};
      const splitByTag = options.splitByTag === 'true';

      // -------------------------------
      // Core HTTP types and interfaces
      // -------------------------------
      files['http-types.ts'] = `
import type { HttpAdapter, RequestOptions, ApiResponse } from './core/http-types';

export type { HttpAdapter, RequestOptions, ApiResponse };
export { ApiSuccess, ApiError } from './core/http-types';
`;

      // -------------------------------
      // Types
      // -------------------------------
      files['types.ts'] = typesContent;

      // -------------------------------
      // Endpoints
      // -------------------------------
      if (splitByTag) {
        const tags = Array.from(new Set(endpoints.map(e => e.tag)));

        for (const tag of tags) {
          const tagEndpoints = endpoints.filter(e => e.tag === tag);
          const endpointContent = generateEndpoints(tagEndpoints, schemaNames);

          files[`${tag}.ts`] = `
import type { HttpAdapter, ApiResponse } from './http-types';
import * as Types from './types';

${endpointContent}
`;
        }

        // Client factory
        const clientContent = generateClientFactory(endpoints, schemaNames);
        files['client.ts'] = clientContent;

        files['index.ts'] = `
${tags.map(tag => `export * from './${tag}';`).join('\n')}
export * from './types';
export * from './http-types';
export * from './client';
`;
      } else {
        const endpointContent = generateEndpoints(endpoints, schemaNames);

        files['endpoints.ts'] = `
import type { HttpAdapter, ApiResponse } from './http-types';
import * as Types from './types';

${endpointContent}
`;

        // Client factory
        const clientContent = generateClientFactory(endpoints, schemaNames);
        files['client.ts'] = clientContent;

        files['index.ts'] = `
export * from './endpoints';
export * from './types';
export * from './http-types';
export * from './client';
`;
      }

      console.log('💾 Writing files...');
      const outputDir = path.join(options.output, 'generated');
      await writeFiles(outputDir, files);

      console.log('✅ SDK generated successfully at:', outputDir);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);