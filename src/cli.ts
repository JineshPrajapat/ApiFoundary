import { Command } from 'commander';
import { run } from './codegen/pipeline.ts';

function main(): void {
  const program = new Command();

  program
    .name('apifoundry')
    .description('Generate a typed TypeScript SDK from an OpenAPI 3.x spec')
    .version('1.0.0');

  program
    .command('generate')
    .description('Generate TypeScript types and endpoint builders from an OpenAPI spec')
    .requiredOption('--input <path>',  'Path or URL to OpenAPI 3.x JSON/YAML spec')
    .requiredOption('--output <dir>',  'Root output directory (e.g. src/)')
    .option('--sdk-dir <name>',        'Subdirectory for generated SDK files', 'api')
    .option('--split-by-tag',          'One endpoint file per OpenAPI tag', false)
    // Bug 2 fix: --verbose flag added so debug output is never printed by default
    .option('--verbose',               'Print debug information during generation', false)
    .action(async (opts) => {
      console.log('\n ApiFoundry\n');

      try {
        const result = await run(
          {
            input:  opts.input,
            output: opts.output,
            options: {
              splitByTag: opts.splitByTag,
              sdkDir:     opts.sdkDir,
              verbose:    opts.verbose,
            },
          },
          (msg) => console.log(`   ${msg}`),
        );

        if (opts.verbose) {
          console.log('\n[verbose] Full result:', JSON.stringify(result, null, 2));
        }

        console.log('\n Done\n');

        console.log(
          `   Endpoints: ${result.counts.total} total across ${result.tags.length} tag(s)`,
        );

        if (result.written.length) {
          console.log('\n   Written:');
          result.written.forEach((f) => console.log(`     + ${f}`));
        }

        if (result.skipped.length) {
          console.log('\n   Skipped (already exists - yours to keep):');
          result.skipped.forEach((f) => console.log(`     ~ ${f}`));
        }

        if (result.warnings.length) {
          console.log('\n   Warnings:');
          result.warnings.forEach((w) => console.log(`     ! ${w}`));
        }

        console.log(`
Next steps:
   1. Edit ${opts.output}/api.ts - set your baseUrl or axiosInstance
   2. import { api } from './api'  - done.
`);
      } catch (err) {
        console.error('\n', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  program.parse(process.argv);
}

main();