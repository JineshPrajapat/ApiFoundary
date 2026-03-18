import { describe, it, expect, vi } from 'vitest';
import { bindApi } from '../../../src/runtime/bind-api.ts';
import type { HttpAdapter, RequestDescriptor, EndpointTree } from '../../../src/runtime/contracts.ts';

// ─── Mock adapter ─────────────────────────────────────────────────────────────

function mockAdapter(returnValue: unknown = {}): HttpAdapter {
  return { execute: vi.fn().mockResolvedValue(returnValue) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Flat module
// ─────────────────────────────────────────────────────────────────────────────

describe('bindApi — flat module', () => {
  const getPet = (id: number): RequestDescriptor<{ id: number; name: string }> => ({
    method: 'GET',
    path: `/pet/${id}`,
  });

  const createPet = (body: { name: string }): RequestDescriptor<{ id: number; name: string }> => ({
    method: 'POST',
    path: '/pet',
    body,
  });

  it('transforms descriptor builders into async functions', async () => {
    const adapter = mockAdapter({ id: 1, name: 'Rex' });
    const bound = bindApi({ getPet, createPet }, adapter);

    expect(typeof bound.getPet).toBe('function');
    expect(typeof bound.createPet).toBe('function');
  });

  it('calls adapter.execute with the descriptor', async () => {
    const adapter = mockAdapter({ id: 1, name: 'Rex' });
    const bound = bindApi({ getPet }, adapter);

    await bound.getPet(42);

    expect(adapter.execute).toHaveBeenCalledOnce();
    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/pet/42' }),
    );
  });

  it('returns the value from adapter.execute', async () => {
    const expected = { id: 7, name: 'Buddy' };
    const adapter  = mockAdapter(expected);
    const bound    = bindApi({ getPet }, adapter);

    const result = await bound.getPet(7);
    expect(result).toEqual(expected);
  });

  it('passes body to the descriptor', async () => {
    const adapter = mockAdapter({ id: 1, name: 'Rex' });
    const bound   = bindApi({ createPet }, adapter);

    await bound.createPet({ name: 'Rex' });

    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/pet', body: { name: 'Rex' } }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nested tree
// ─────────────────────────────────────────────────────────────────────────────

describe('bindApi — nested EndpointTree', () => {
  const getPet  = (id: number): RequestDescriptor<{ id: number }> => ({ method: 'GET',  path: `/pet/${id}` });
  const addPet  = (body: { name: string }): RequestDescriptor<{ id: number }> => ({ method: 'POST', path: '/pet', body });
  const getUser = (id: string): RequestDescriptor<{ username: string }> => ({ method: 'GET', path: `/user/${id}` });
  const login   = (): RequestDescriptor<string> => ({ method: 'GET', path: '/user/login' });

  const tree: EndpointTree = {
    pet:  { getPet, addPet },
    user: { getUser, login },
  };

  it('recurses into nested namespaces', async () => {
    const adapter = mockAdapter({});
    const bound   = bindApi(tree, adapter);

    expect(typeof (bound.pet as any).getPet).toBe('function');
    expect(typeof (bound.pet as any).addPet).toBe('function');
    expect(typeof (bound.user as any).getUser).toBe('function');
    expect(typeof (bound.user as any).login).toBe('function');
  });

  it('calls adapter.execute through a nested namespace', async () => {
    const adapter = mockAdapter({ id: 1 });
    const bound   = bindApi(tree, adapter);

    await (bound.pet as any).getPet(99);

    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/pet/99' }),
    );
  });

  it('each namespace gets its own bound functions', async () => {
    const adapter = mockAdapter({ username: 'alice' });
    const bound   = bindApi(tree, adapter);

    await (bound.user as any).getUser('alice');

    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/user/alice' }),
    );
  });

  it('deeply nested 3-level tree', async () => {
    const deepTree: EndpointTree = {
      manager: {
        auth: {
          login: (): RequestDescriptor<string> => ({ method: 'POST', path: '/manager/auth/login' }),
        },
      },
    };
    const adapter = mockAdapter('token');
    const bound   = bindApi(deepTree, adapter);

    const result = await ((bound.manager as any).auth as any).login();
    expect(result).toBe('token');
    expect(adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/manager/auth/login' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('bindApi — edge cases', () => {
  it('handles empty module gracefully', () => {
    const adapter = mockAdapter();
    const bound   = bindApi({}, adapter);
    expect(bound).toEqual({});
  });

  it('handles module with no-arg endpoints', async () => {
    const ping = (): RequestDescriptor<string> => ({ method: 'GET', path: '/ping' });
    const adapter = mockAdapter('pong');
    const bound   = bindApi({ ping }, adapter);

    const result = await bound.ping();
    expect(result).toBe('pong');
  });
});