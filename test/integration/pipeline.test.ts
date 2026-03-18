import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { run } from '../../src/codegen/pipeline.ts';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE   = path.join(__dirname, '../fixtures/petstore.json');
const OUT_DIR   = path.join(__dirname, '../../tmp/pipeline-test');

describe('pipeline — Petstore end-to-end', () => {
  let result: Awaited<ReturnType<typeof run>>;

  beforeAll(async () => {
    await fs.remove(OUT_DIR);
    result = await run(
      { input: FIXTURE, output: OUT_DIR, options: { sdkDir: 'api', splitByTag: true } },
    );
  });

  afterAll(async () => {
    await fs.remove(OUT_DIR);
  });

  // ── PipelineResult shape ──────────────────────────────────────────────────

  it('returns a non-empty written array', () => {
    expect(result.written.length).toBeGreaterThan(0);
  });

  it('returns correct counts', () => {
    expect(result.counts.total).toBe(12);
    expect(result.counts.byTag['pet']).toBe(5);
    expect(result.counts.byTag['store']).toBe(3);
    expect(result.counts.byTag['user']).toBe(4);
  });

  it('returns 3 unique tags', () => {
    expect(result.tags).toHaveLength(3);
    expect(result.tags).toContain('pet');
    expect(result.tags).toContain('store');
    expect(result.tags).toContain('user');
  });

  it('emits warnings only for endpoints with no response schema', () => {
    // deletePet and deleteUser have no response body — expect "any" warnings
    const anyWarns = result.warnings.filter((w) => w.includes('No 200/201'));
    expect(anyWarns.length).toBeGreaterThan(0);
  });

  // ── Generated files on disk ───────────────────────────────────────────────

  it('writes api/types/index.ts', async () => {
    const p = path.join(OUT_DIR, 'api/types/index.ts');
    expect(await fs.pathExists(p)).toBe(true);
  });

  it('writes api/pet.ts', async () => {
    expect(await fs.pathExists(path.join(OUT_DIR, 'api/pet.ts'))).toBe(true);
  });

  it('writes api/store.ts', async () => {
    expect(await fs.pathExists(path.join(OUT_DIR, 'api/store.ts'))).toBe(true);
  });

  it('writes api/user.ts', async () => {
    expect(await fs.pathExists(path.join(OUT_DIR, 'api/user.ts'))).toBe(true);
  });

  it('writes api/index.ts barrel', async () => {
    expect(await fs.pathExists(path.join(OUT_DIR, 'api/index.ts'))).toBe(true);
  });

  it('writes api.ts entry file', async () => {
    expect(await fs.pathExists(path.join(OUT_DIR, 'api.ts'))).toBe(true);
  });

  // ── Content checks ────────────────────────────────────────────────────────

  it('types file exports Petstore schemas', async () => {
    const content = await fs.readFile(path.join(OUT_DIR, 'api/types/index.ts'), 'utf-8');
    expect(content).toContain('export interface Pet');
    expect(content).toContain('export interface Order');
    expect(content).toContain('export interface User');
  });

  it('pet.ts exports typed endpoint functions', async () => {
    const content = await fs.readFile(path.join(OUT_DIR, 'api/pet.ts'), 'utf-8');
    expect(content).toContain('export const Pet_addPet');
    expect(content).toContain('export const Pet_getPetById');
    expect(content).toContain('RequestDescriptor<Types.Pet>');
  });

  it('api.ts imports all tag modules', async () => {
    const content = await fs.readFile(path.join(OUT_DIR, 'api.ts'), 'utf-8');
    expect(content).toContain(`import * as pet from`);
    expect(content).toContain(`import * as store from`);
    expect(content).toContain(`import * as user from`);
  });

  it('api.ts uses direct module reference (no { ...spread } wrapper)', async () => {
    const content = await fs.readFile(path.join(OUT_DIR, 'api.ts'), 'utf-8');
    // Correct:  pet: pet,
    // Wrong:    pet: { ...pet },
    expect(content).toContain('pet: pet,');
    expect(content).toContain('store: store,');
    expect(content).not.toMatch(/pet:\s*\{[^}]*\.\.\.\s*pet[^}]*\}/);
  });

  it('api.ts exports api const and Api type', async () => {
    const content = await fs.readFile(path.join(OUT_DIR, 'api.ts'), 'utf-8');
    expect(content).toContain('export const api = createClient(');
    expect(content).toContain('export type Api = typeof api');
  });

  it('barrel index.ts uses namespaced exports', async () => {
    const content = await fs.readFile(path.join(OUT_DIR, 'api/index.ts'), 'utf-8');
    expect(content).toContain('export * as pet from');
    expect(content).toContain('export * as store from');
    expect(content).toContain('export * as user from');
  });

  // ── api.ts is skipped on re-run (neverOverwrite) ─────────────────────────

  it('skips api.ts on second run (user-owned file)', async () => {
    const result2 = await run(
      { input: FIXTURE, output: OUT_DIR, options: { sdkDir: 'api', splitByTag: true } },
    );
    expect(result2.skipped.some((f) => f.includes('api.ts'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pipeline — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline — edge-case spec', () => {
  const EDGE_FIXTURE = path.join(__dirname, '../fixtures/edge-cases.json');
  const EDGE_OUT     = path.join(__dirname, '../../tmp/edge-pipeline-test');

  beforeAll(async () => { await fs.remove(EDGE_OUT); });
  afterAll(async ()  => { await fs.remove(EDGE_OUT); });

  it('runs without throwing on edge-case spec', async () => {
    await expect(
      run({ input: EDGE_FIXTURE, output: EDGE_OUT, options: { sdkDir: 'api', splitByTag: true } }),
    ).resolves.toBeDefined();
  });

  it('remaps "default" tag to "general" in output files', async () => {
    await run({ input: EDGE_FIXTURE, output: EDGE_OUT, options: { sdkDir: 'api', splitByTag: true } });
    expect(await fs.pathExists(path.join(EDGE_OUT, 'api/general.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(EDGE_OUT, 'api/default.ts'))).toBe(false);
  });

  it('writes pingServer.ts (not ping-server.ts)', async () => {
    await run({ input: EDGE_FIXTURE, output: EDGE_OUT, options: { sdkDir: 'api', splitByTag: true } });
    expect(await fs.pathExists(path.join(EDGE_OUT, 'api/pingServer.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(EDGE_OUT, 'api/ping-server.ts'))).toBe(false);
  });

  it('writes nested admin/fees.ts', async () => {
    await run({ input: EDGE_FIXTURE, output: EDGE_OUT, options: { sdkDir: 'api', splitByTag: true } });
    expect(await fs.pathExists(path.join(EDGE_OUT, 'api/admin/fees.ts'))).toBe(true);
  });
});