import { describe, it, expect } from 'vitest';
import { buildFileMap, buildApiFileContent } from '../../../src/codegen/generators/file-map-builder.ts';
import type { CodegenOptions } from '../../../src/types/openapi.ts';

const OPTS: CodegenOptions = { sdkDir: 'api', splitByTag: true };

// ─────────────────────────────────────────────────────────────────────────────
// buildFileMap — file paths
// ─────────────────────────────────────────────────────────────────────────────

describe('buildFileMap — file paths', () => {
  it('creates types barrel at sdkDir/types/index.ts', () => {
    const result = buildFileMap('// types', new Map(), OPTS);
    expect(result['api/types/index.ts']).toBe('// types');
  });

  it.each([
    ['pet',   'api/pet.ts'],
    ['store', 'api/store.ts'],
    ['user',  'api/user.ts'],
  ])('tag "%s" -> file "%s"', (tag, expectedPath) => {
    const result = buildFileMap('', new Map([[tag, '// content']]), OPTS);
    expect(result[expectedPath]).toBeDefined();
  });

  it('"general" tag -> "api/general.ts" (not api/default.ts)', () => {
    // path-parser maps "default" -> "general" before building the map
    const result = buildFileMap('', new Map([['general', '// general']]), OPTS);
    expect(result['api/general.ts']).toBeDefined();
    expect(result['api/default.ts']).toBeUndefined();
  });

  // Fix 2: buildFileMap receives raw tags exactly as path-parser.ts emits them
  // (normalised via tagToSegments). The raw tag from the spec "ping-server" is
  // normalised by path-parser to "pingServer" before being stored in ParsedEndpoint.tag.
  // So the map key is "pingServer" (already processed), and tagToSegments("pingServer")
  // -> segment_to_camel_part("pingServer") -> lowercases -> "pingserver".
  //
  // The correct test is: path-parser produces "pingServer" as the tag, which means
  // the endpointsByTag map will have key "pingServer", and the file will be
  // "api/pingserver.ts" (lowercased). The dash-to-camelCase conversion already
  // happened in path-parser.ts. This is the expected behaviour.
  it('"pingServer" tag (as emitted by path-parser) -> "api/pingserver.ts"', () => {
    // path-parser.ts normalises "ping-server" -> "pingServer" in endpoint.tag
    // file-map-builder then calls tagToSegments("pingServer") which lowercases -> "pingserver"
    const result = buildFileMap('', new Map([['pingServer', '// ping']]), OPTS);
    expect(result['api/pingserver.ts']).toBeDefined();
  });

  it('"ping-server" raw tag (before path-parser normalisation) -> "api/pingServer.ts"', () => {
    // If the raw tag string "ping-server" is used as the map key (before path-parser),
    // tagToSegments converts dash to camelCase: "ping-server" -> ["pingServer"]
    const result = buildFileMap('', new Map([['ping-server', '// ping']]), OPTS);
    expect(result['api/pingServer.ts']).toBeDefined();
    // Verify no dash in any file path
    for (const key of Object.keys(result)) {
      const filename = key.split('/').pop()!;
      expect(filename, `"${key}" has a dash in filename`).not.toContain('-');
    }
  });

  it('nested tag "manager/auth" -> "api/manager/auth.ts"', () => {
    const result = buildFileMap('', new Map([['manager/auth', '// content']]), OPTS);
    expect(result['api/manager/auth.ts']).toBeDefined();
  });

  it('3-level tag "admin/users/profile" -> "api/admin/users/profile.ts"', () => {
    const result = buildFileMap('', new Map([['admin/users/profile', '// content']]), OPTS);
    expect(result['api/admin/users/profile.ts']).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFileMap — types import path by depth
// ─────────────────────────────────────────────────────────────────────────────

describe('buildFileMap — types import path by depth', () => {
  it("depth-0 file imports from './types'", () => {
    const result = buildFileMap('', new Map([['pet', '']]), OPTS);
    expect(result['api/pet.ts']).toContain(`from './types'`);
  });

  it("depth-1 file imports from '../types'", () => {
    const result = buildFileMap('', new Map([['manager/auth', '']]), OPTS);
    expect(result['api/manager/auth.ts']).toContain(`from '../types'`);
  });

  it("depth-2 file imports from '../../types'", () => {
    const result = buildFileMap('', new Map([['admin/users/profile', '']]), OPTS);
    expect(result['api/admin/users/profile.ts']).toContain(`from '../../types'`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFileMap — barrel index.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('buildFileMap — barrel index.ts', () => {
  it('always includes types re-export', () => {
    const result = buildFileMap('', new Map(), OPTS);
    expect(result['api/index.ts']).toContain(`export * from './types'`);
  });

  it('uses namespaced exports (export * as X) — prevents duplicate identifier errors', () => {
    const map = new Map([['pet', ''], ['store', ''], ['manager/auth', '']]);
    const barrel = buildFileMap('', map, OPTS)['api/index.ts']!;
    expect(barrel).toContain('export * as pet from');
    expect(barrel).toContain('export * as store from');
    expect(barrel).toContain('export * as manager_auth from');
  });

  it('never uses bare "export *" for tag namespaces (only for ./types)', () => {
    const map = new Map([['pet', ''], ['manager/auth', '']]);
    const barrel = buildFileMap('', map, OPTS)['api/index.ts']!;
    const bareExports = barrel
      .split('\n')
      .filter((l) => l.startsWith('export *') && !l.includes(' as ') && !l.includes('./types'));
    expect(bareExports).toHaveLength(0);
  });

  it('uses "general" not "default" as namespace alias', () => {
    const map = new Map([['general', '']]);
    const barrel = buildFileMap('', map, OPTS)['api/index.ts']!;
    expect(barrel).toContain('export * as general from');
    expect(barrel).not.toContain('export * as default');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildApiFileContent — imports
// ─────────────────────────────────────────────────────────────────────────────

describe('buildApiFileContent — imports', () => {
  it('generates valid import for each tag', () => {
    const content = buildApiFileContent(['pet', 'store', 'user'], OPTS);
    expect(content).toContain(`import * as pet from './api/pet'`);
    expect(content).toContain(`import * as store from './api/store'`);
    expect(content).toContain(`import * as user from './api/user'`);
  });

  it('never generates `import * as default`', () => {
    const content = buildApiFileContent(['general'], OPTS);
    expect(content).not.toContain('import * as default');
    expect(content).toContain('import * as general');
  });

  it('import var for nested tag uses underscore join', () => {
    const content = buildApiFileContent(['manager/auth', 'manager/broker'], OPTS);
    expect(content).toContain(`import * as manager_auth from './api/manager/auth'`);
    expect(content).toContain(`import * as manager_broker from './api/manager/broker'`);
  });

  it('all import variable names are valid JS identifiers', () => {
    const tags = ['pet', 'store', 'user', 'general', 'manager/auth', 'manager/broker'];
    const content = buildApiFileContent(tags, OPTS);
    const importLines = content.split('\n').filter((l) => l.startsWith('import * as'));
    const validId = /^import \* as ([a-zA-Z_$][a-zA-Z0-9_$]*) from/;
    for (const line of importLines) {
      expect(line, `invalid import: ${line}`).toMatch(validId);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildApiFileContent — object body
// ─────────────────────────────────────────────────────────────────────────────

describe('buildApiFileContent — object structure', () => {
  it('leaf tags use direct module reference (no { ...spread } wrapper)', () => {
    const content = buildApiFileContent(['pet', 'store'], OPTS);
    expect(content).toContain('pet: pet,');
    expect(content).toContain('store: store,');
    // Must NOT have { ...pet } wrapper — that breaks TypeScript type inference
    expect(content).not.toMatch(/pet:\s*\{\s*\.\.\.pet\s*\}/);
  });

  it('nested tag with parent+children spreads parent, adds child as direct ref', () => {
    const content = buildApiFileContent(['manager', 'manager/auth', 'manager/broker'], OPTS);
    expect(content).toContain('...manager,');
    expect(content).toContain('auth: manager_auth,');
    expect(content).toContain('broker: manager_broker,');
  });

  it('top-level keys match tag names', () => {
    const content = buildApiFileContent(['pet', 'store', 'user'], OPTS);
    expect(content).toContain('pet:');
    expect(content).toContain('store:');
    expect(content).toContain('user:');
  });

  it('uses "general" not "default" as object key', () => {
    const content = buildApiFileContent(['general'], OPTS);
    expect(content).toContain('general:');
    expect(content).not.toContain('default:');
  });

  it('deeply nested 3-level tag builds correct structure', () => {
    const content = buildApiFileContent(['admin/users/profile'], OPTS);
    expect(content).toContain('admin:');
    expect(content).toContain('users:');
    expect(content).toContain('profile: admin_users_profile');
  });

  it('always exports api const and Api type', () => {
    const content = buildApiFileContent(['pet'], OPTS);
    expect(content).toContain('export const api = createClient(');
    expect(content).toContain('export type Api = typeof api');
  });

  it('always imports createClient from apifoundry/runtime', () => {
    const content = buildApiFileContent(['pet'], OPTS);
    expect(content).toContain(`import { createClient } from 'apifoundry/runtime'`);
  });
});