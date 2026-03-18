import { defineConfig } from 'tsup';

/**
 * tsup.config.ts
 *
 * ARCHITECTURE: two-tool build pipeline
 *
 *   tsup  -> .js + .cjs + sourcemaps   (esbuild — handles .ts imports natively)
 *   tsc   -> .d.ts + .d.ts.map         (tsconfig.build.json — allowImportingTsExtensions)
 *
 * Full build command (package.json):
 *   tsup --no-dts && tsc -p tsconfig.build.json
 *
 * Output:
 *   dist/cli.js                        ESM + shebang (no types needed)
 *   dist/runtime/index.js + .cjs       ESM + CJS
 *   dist/runtime/index.d.ts + .map     declarations from tsc
 *   dist/codegen/pipeline.js + .cjs    ESM + CJS
 *   dist/codegen/pipeline.d.ts + .map  declarations from tsc
 */
export default defineConfig([

  // CLI -----------------------------------------------------------------------
  {
    entry:    { cli: 'src/cli.ts' },
    format:   ['esm'],
    target:   'node18',
    platform: 'node',
    outDir:   'dist',
    tsconfig: 'tsconfig.build.json',
    dts:      false,   // tsc handles declarations — NOT tsup's internal dts worker
    clean:    true,    // wipe dist/ once, on the first entry
    sourcemap: true,
    splitting: false,
    bundle:    true,
    external: ['commander', 'fs-extra', 'openapi-types', 'prettier'],
    banner: { js: '#!/usr/bin/env node' },
    esbuildOptions(options) {
      // Resolve .ts extension imports in source files
      options.resolveExtensions = ['.ts', '.tsx', '.js', '.json'];
    },
  },

  // Runtime (public package API) -----------------------------------------------
  {
    entry:    { 'runtime/index': 'src/runtime/index.ts' },
    format:   ['esm', 'cjs'],
    target:   'node18',
    platform: 'node',
    outDir:   'dist',
    tsconfig: 'tsconfig.build.json',
    dts:      false,
    clean:    false,   // CLI entry already cleaned
    sourcemap: true,
    splitting: false,
    bundle:    true,
    external: [],      // runtime has zero runtime dependencies
    esbuildOptions(options) {
      options.resolveExtensions = ['.ts', '.tsx', '.js', '.json'];
    },
  },

  // Codegen pipeline (programmatic API) ----------------------------------------
  {
    entry:    { 'codegen/pipeline': 'src/codegen/pipeline.ts' },
    format:   ['esm', 'cjs'],
    target:   'node18',
    platform: 'node',
    outDir:   'dist',
    tsconfig: 'tsconfig.build.json',
    dts:      false,
    clean:    false,
    sourcemap: true,
    splitting: false,
    bundle:    true,
    external: ['fs-extra', 'openapi-types', 'prettier'],
    esbuildOptions(options) {
      options.resolveExtensions = ['.ts', '.tsx', '.js', '.json'];
    },
  },
]);