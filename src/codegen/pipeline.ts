import { loadSpec } from './parsers/spec-loader.ts';
import { parseSchemas } from './parsers/schema-parser.ts';
import { parsePaths } from './parsers/path-parser.ts';
import { generateTypes } from './generators/type-generator.ts';
import { generateEndpoints } from './generators/endpoint-generator.ts';
import { buildFileMap, buildApiFileContent } from './generators/file-map-builder.ts';
import { writeFiles } from './writers/file-writer.ts';
import { countEndpoints } from './utils/endpoint-counter.ts';
import type { CodegenOptions, FileMap, ParsedEndpoint } from '../types/openapi.ts';

export interface PipelineInput {
  /** Path or URL to the OpenAPI JSON spec */
  input: string;
  /** Root directory to write files into (e.g. 'src/') */
  output: string;
  options: CodegenOptions;
}

export interface PipelineResult {
  written: string[];
  skipped: string[];
  warnings: string[];
  tags: string[];
  counts: {
    total: number;
    byTag: Record<string, number>;
  };
}

/**
 * Executes the full codegen pipeline:
 *   load spec → parse schemas → parse paths → generate code → write files
 *
 * Set options.verbose = true (via --verbose CLI flag) to print debug info.
 */
export async function run(
  { input, output, options }: PipelineInput,
  onStep: (msg: string) => void = () => {},
): Promise<PipelineResult> {
  const warnings: string[] = [];
  const warn = (msg: string) => warnings.push(msg);
  const verbose = options.verbose ?? false;

  onStep('Loading spec...');
  const spec = await loadSpec(input);

  onStep('Parsing schemas...');
  const schemas = parseSchemas(spec);
  const schemaNames = schemas.map((s) => s.name);

  onStep('Parsing paths...');
  const endpoints = parsePaths(spec, warn);

  if (verbose) {
    console.log('[verbose] Parsed endpoints:', JSON.stringify(endpoints, null, 2));
  }

  onStep('Counting endpoints...');
  const counts = countEndpoints(endpoints);

  if (verbose) {
    console.log('[verbose] Endpoint counts:', counts);
  }

  onStep('Generating code...');
  const tags = [...new Set(endpoints.map((e) => e.tag))];
  const typesContent = generateTypes(schemas);
  const endpointsByTag = groupByTag(endpoints, schemaNames, options);

  const apiFilePath = 'api.ts';

  const files: FileMap = {
    ...buildFileMap(typesContent, endpointsByTag, options),
    [apiFilePath]: buildApiFileContent(tags, options),
  };

  onStep('Writing files...');
  const { written, skipped } = await writeFiles(output, files, [apiFilePath]);

  return { written, skipped, warnings, tags, counts };
}

function groupByTag(
  endpoints: ParsedEndpoint[],
  schemaNames: string[],
  options: CodegenOptions,
): Map<string, string> {
  const map = new Map<string, string>();

  if (options.splitByTag) {
    const tags = [...new Set(endpoints.map((e) => e.tag))];
    for (const tag of tags) {
      map.set(tag, generateEndpoints(endpoints.filter((e) => e.tag === tag), schemaNames));
    }
  } else {
    map.set('all', generateEndpoints(endpoints, schemaNames));
  }

  return map;
}