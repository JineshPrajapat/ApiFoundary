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
    .requiredOption('--input <path>',  'Path or URL to OpenAPI 3.x JSON spec')
    .requiredOption('--output <dir>',  'Root output directory (e.g. src/)')
    .option('--sdk-dir <name>',        'Subdirectory for generated SDK files', 'api')
    .option('--split-by-tag',          'One endpoint file per OpenAPI tag',    false)
    .action(async (opts) => {
      console.log('\n🔨 ApiFoundry\n');

      try {
        const result = await run(
          {
            input:  opts.input,
            output: opts.output,
            options: {
              splitByTag: opts.splitByTag,
              sdkDir:     opts.sdkDir,
            },
          },
          (msg) => console.log(`   ⏳ ${msg}`),
        );
        console.log("result", result)

        console.log(`\n✅ Done\n`);

        if (result.written.length) {
          console.log('   Written:');
          result.written.forEach((f) => console.log(`     + ${f}`));
        }

        if (result.skipped.length) {
          console.log('\n   Skipped (already exists — yours to keep):');
          result.skipped.forEach((f) => console.log(`     ~ ${f}`));
        }

        if (result.warnings.length) {
          console.log('\n   ⚠️  Warnings:');
          result.warnings.forEach((w) => console.log(`     ! ${w}`));
        }

        console.log(`
📋 Next steps:
   1. cp ${opts.output}/api.ts.template ${opts.output}/api.ts
   2. Set your baseUrl (or axiosInstance) in api.ts
   3. import { api } from './api'  — done.
`);
      } catch (err) {
        console.error('\n❌', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  program.parse(process.argv);
}

main();