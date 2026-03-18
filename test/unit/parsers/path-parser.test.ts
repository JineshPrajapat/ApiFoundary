import { describe, it, expect } from 'vitest';
import { parsePaths } from '../../../src/codegen/parsers/path-parser.ts';
import type { OpenAPIV3 } from 'openapi-types';
import petstoreSpec   from '../../fixtures/petstore.json';
import edgeCasesSpec  from '../../fixtures/edge-cases.json';

const petstore  = petstoreSpec  as unknown as OpenAPIV3.Document;
const edgeCases = edgeCasesSpec as unknown as OpenAPIV3.Document;

// ─── helpers ─────────────────────────────────────────────────────────────────

function parse(spec: OpenAPIV3.Document) {
  const warnings: string[] = [];
  const endpoints = parsePaths(spec, (w) => warnings.push(w));
  return { endpoints, warnings };
}

function find(name: string, endpoints: ReturnType<typeof parsePaths>) {
  return endpoints.find((e) => e.name === name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Petstore — naming convention (PascalTag_action, no Controller class)
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePaths — Petstore naming', () => {
  const { endpoints } = parse(petstore);

  it('strips Controller prefix from operationId', () => {
    // Petstore uses bare operationIds like "addPet" — no Controller prefix
    // After PascalTag prefix: Pet_addPet
    expect(find('Pet_addPet', endpoints)).toBeDefined();
    expect(find('Pet_updatePet', endpoints)).toBeDefined();
    expect(find('Pet_findPetsByStatus', endpoints)).toBeDefined();
    expect(find('Pet_getPetById', endpoints)).toBeDefined();
    expect(find('Pet_deletePet', endpoints)).toBeDefined();
  });

  it('prefixes Store tag correctly', () => {
    expect(find('Store_getInventory', endpoints)).toBeDefined();
    expect(find('Store_placeOrder', endpoints)).toBeDefined();
    expect(find('Store_getOrderById', endpoints)).toBeDefined();
  });

  it('prefixes User tag correctly', () => {
    expect(find('User_createUser', endpoints)).toBeDefined();
    expect(find('User_loginUser', endpoints)).toBeDefined();
    expect(find('User_getUserByName', endpoints)).toBeDefined();
    expect(find('User_deleteUser', endpoints)).toBeDefined();
  });

  it('all names are valid TypeScript identifiers', () => {
    const validId = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    for (const ep of endpoints) {
      expect(ep.name, `"${ep.name}" is not a valid identifier`).toMatch(validId);
    }
  });

  it('no name contains "Controller"', () => {
    for (const ep of endpoints) {
      expect(ep.name, `"${ep.name}" still contains Controller`).not.toContain('Controller');
    }
  });

  it('all names are globally unique', () => {
    const names = endpoints.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('parses all 12 expected endpoints from Petstore', () => {
    expect(endpoints.length).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Petstore — tag normalisation
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePaths — Petstore tags', () => {
  const { endpoints } = parse(petstore);

  it('pet tag endpoints have tag="pet"', () => {
    const petEps = endpoints.filter((e) => e.tag === 'pet');
    expect(petEps.length).toBeGreaterThan(0);
    for (const ep of petEps) expect(ep.tag).toBe('pet');
  });

  it('store tag endpoints have tag="store"', () => {
    const storeEps = endpoints.filter((e) => e.tag === 'store');
    expect(storeEps.length).toBeGreaterThan(0);
  });

  it('no tag contains a dash', () => {
    for (const ep of endpoints) {
      expect(ep.tag).not.toContain('-');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Petstore — parameters
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePaths — Petstore parameters', () => {
  const { endpoints } = parse(petstore);

  it('Pet_getPetById has path param petId:number', () => {
    const ep = find('Pet_getPetById', endpoints)!;
    expect(ep).toBeDefined();
    expect(ep.pathParams).toHaveLength(1);
    expect(ep.pathParams[0]).toEqual({ name: 'petId', type: 'number' });
  });

  it('Pet_deletePet has path param petId:number', () => {
    const ep = find('Pet_deletePet', endpoints)!;
    expect(ep.pathParams[0]?.name).toBe('petId');
  });

  it('User_getUserByName has path param username:string', () => {
    const ep = find('User_getUserByName', endpoints)!;
    expect(ep.pathParams[0]).toEqual({ name: 'username', type: 'string' });
  });

  it('Pet_findPetsByStatus has required query param status', () => {
    const ep = find('Pet_findPetsByStatus', endpoints)!;
    expect(ep.queryParams).toHaveLength(1);
    expect(ep.queryParams[0]?.name).toBe('status');
    expect(ep.queryParams[0]?.required).toBe(true);
  });

  it('User_loginUser has two optional query params', () => {
    const ep = find('User_loginUser', endpoints)!;
    expect(ep.queryParams).toHaveLength(2);
    expect(ep.queryParams[0]?.required).toBe(false);
    expect(ep.queryParams[1]?.required).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Petstore — response and request body types
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePaths — Petstore response types', () => {
  const { endpoints } = parse(petstore);

  it.each([
    ['Pet_addPet',          'Pet'],
    ['Pet_updatePet',       'Pet'],
    ['Pet_getPetById',      'Pet'],
    ['Store_placeOrder',    'Order'],
    ['Store_getOrderById',  'Order'],
    ['User_createUser',     'User'],
    ['User_getUserByName',  'User'],
    ['User_loginUser',      'string'],
  ])('%s -> responseType "%s"', (name, expectedType) => {
    const ep = find(name, endpoints);
    expect(ep, `endpoint ${name} not found`).toBeDefined();
    expect(ep!.responseType).toBe(expectedType);
  });

  it('Pet_findPetsByStatus returns array type', () => {
    const ep = find('Pet_findPetsByStatus', endpoints)!;
    expect(ep.responseType).toContain('Pet');
    expect(ep.responseType).toContain('[]');
  });

  it('endpoints without response schema return "any"', () => {
    const ep = find('Pet_deletePet', endpoints)!;
    expect(ep.responseType).toBe('any');
  });

  it('Pet_addPet has requestBodyType "Pet"', () => {
    const ep = find('Pet_addPet', endpoints)!;
    expect(ep.requestBodyType).toBe('Pet');
  });

  it('Store_placeOrder has requestBodyType "Order"', () => {
    const ep = find('Store_placeOrder', endpoints)!;
    expect(ep.requestBodyType).toBe('Order');
  });

  it('endpoints without body have no requestBodyType', () => {
    const ep = find('Pet_getPetById', endpoints)!;
    expect(ep.requestBodyType).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Petstore — HTTP methods
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePaths — HTTP methods', () => {
  const { endpoints } = parse(petstore);

  it.each([
    ['Pet_addPet',       'POST'],
    ['Pet_updatePet',    'PUT'],
    ['Pet_getPetById',   'GET'],
    ['Pet_deletePet',    'DELETE'],
    ['Store_placeOrder', 'POST'],
    ['User_createUser',  'POST'],
    ['User_loginUser',   'GET'],
    ['User_deleteUser',  'DELETE'],
  ])('%s has method %s', (name, method) => {
    const ep = find(name, endpoints);
    expect(ep?.method).toBe(method);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases — reserved tag ("default"), dashes, nested tags, cross-tag dedup
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePaths — edge cases', () => {
  const { endpoints, warnings } = parse(edgeCases);

  it('"default" tag is remapped to "general"', () => {
    const pingEp = endpoints.find((e) => e.path === '/ping');
    expect(pingEp).toBeDefined();
    expect(pingEp!.tag).toBe('general');
    expect(pingEp!.tag).not.toBe('default');
  });

  it('"ping-server" tag is normalised to "pingServer" — no dashes', () => {
    const ep = endpoints.find((e) => e.path === '/ping-server');
    expect(ep).toBeDefined();
    expect(ep!.tag).toBe('pingServer');
    expect(ep!.tag).not.toContain('-');
  });

  it('nested tag "admin/fees" keeps slash-joined structure', () => {
    const ep = endpoints.find((e) => e.path === '/admin/fees/getSettings');
    expect(ep!.tag).toBe('admin/fees');
  });

  it('cross-tag: same operationId produces unique names per tag', () => {
    // AuthController_login appears in both "auth" and "manager/auth"
    const authEp   = endpoints.find((e) => e.tag === 'auth' && e.path === '/auth/login');
    const mgrAuthEp = endpoints.find((e) => e.tag === 'manager/auth');
    expect(authEp).toBeDefined();
    expect(mgrAuthEp).toBeDefined();
    expect(authEp!.name).not.toBe(mgrAuthEp!.name);
    expect(authEp!.name).toContain('Auth_');
    expect(mgrAuthEp!.name).toContain('ManagerAuth_');
  });

  it('within-tag: duplicate operationId emits a warning', () => {
    const dupWarning = warnings.find((w) => w.includes('Duplicate name'));
    expect(dupWarning).toBeDefined();
  });

  it('within-tag: duplicate operationId still produces unique names', () => {
    const names = endpoints.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('path param is correctly extracted from /items/{id}', () => {
    const ep = endpoints.find((e) => e.path === '/items/{id}')!;
    expect(ep.pathParams).toHaveLength(1);
    expect(ep.pathParams[0]).toEqual({ name: 'id', type: 'string' });
  });

  it('query param is correctly extracted from /items/{id}', () => {
    const ep = endpoints.find((e) => e.path === '/items/{id}')!;
    expect(ep.queryParams).toHaveLength(1);
    expect(ep.queryParams[0]?.name).toBe('include');
    expect(ep.queryParams[0]?.required).toBe(false);
  });

  it('emits warning for endpoint with no 200/201 response', () => {
    const anyWarning = warnings.find((w) => w.includes('No 200/201'));
    expect(anyWarning).toBeDefined();
  });
});