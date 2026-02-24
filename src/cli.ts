import { Command } from 'commander';
import { loadOpenAPI } from './core/load-openapi.ts';
import { parseSchemas } from './core/parse-schemas.ts';
import { parsePaths } from './core/parse-paths.ts';
import { generateTypes } from './core/generate-types.ts';
import { generateEndpoints } from './core/generate-endpoints.ts';
import { writeFiles } from './core/write-files.ts';
import { fetchTemplate } from './http/fetch-template.ts';
import { axiosTemplate } from './http/axios-template.ts';

const program = new Command();

program
  .name('apifoundry')
  .description('Generate a fully typed TypeScript SDK from OpenAPI 3.x')
  .version('1.0.0');

program
  .command('generate')
  .requiredOption('--input <path>', 'URL or local OpenAPI spec')
  .requiredOption('--output <directory>', 'Output directory')
  .option('--http <type>', 'fetch or axios', 'fetch')
  .option('--split-by-tag <boolean>', 'Split files by tag', 'true')
  .option('--base-url <url>', 'Default base URL', '')
  .option('--timeout <ms>', 'Default timeout (ms)', '30000')
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

      // -------------------------
      // Generate request client
      // -------------------------
      let requestTemplate =
        options.http === 'axios' ? axiosTemplate : fetchTemplate;

      if (options.baseUrl || options.timeout !== '30000') {
        const updates: string[] = [];

        if (options.baseUrl) {
          updates.push(`baseUrl: '${options.baseUrl}'`);
        }

        if (options.timeout !== '30000') {
          updates.push(`timeout: ${options.timeout}`);
        }

        requestTemplate += `\nsetConfig({ ${updates.join(', ')} });\n`;
      }

      files['core/request.ts'] = requestTemplate;

      // -------------------------
      // Types
      // -------------------------
      files['types.ts'] = typesContent;

      // -------------------------
      // Endpoints
      // -------------------------

      if (splitByTag) {
        const tags = Array.from(new Set(endpoints.map(e => e.tag)));

        for (const tag of tags) {
          const tagEndpoints = endpoints.filter(e => e.tag === tag);
          const endpointContent = generateEndpoints(tagEndpoints, schemaNames);

          files[`${tag}.ts`] = `
import { request } from './core/request';
import type { ApiResponse } from './core/request';
import * as Types from './types';

${endpointContent}
`;
        }

        files['index.ts'] = `
${tags.map(tag => `export * from './${tag}';`).join('\n')}
export * from './types';
export { setConfig } from './core/request';
`;
      } else {
        const endpointContent = generateEndpoints(endpoints, schemaNames);

        files['index.ts'] = `
import { request, setConfig } from './core/request';
import type { ApiResponse } from './core/request';
export * from './types';
export { setConfig };

${endpointContent}
`;
      }

      console.log('💾 Writing files...');
      await writeFiles(options.output, files);

      console.log('✅ SDK generated successfully at:', options.output);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);