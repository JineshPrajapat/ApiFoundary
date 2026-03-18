import { describe, it, expect } from 'vitest';
import { countEndpoints } from '../../../src/codegen/utils/endpoint-counter.ts';
import { parsePaths }     from '../../../src/codegen/parsers/path-parser.ts';
import type { OpenAPIV3 } from 'openapi-types';
import petstoreSpec from '../../fixtures/petstore.json';

const petstore = petstoreSpec as unknown as OpenAPIV3.Document;

describe('countEndpoints', () => {
  it('returns total=0 and empty byTag for empty array', () => {
    const result = countEndpoints([]);
    expect(result.total).toBe(0);
    expect(result.byTag).toEqual({});
  });

  it('counts Petstore endpoints correctly', () => {
    const endpoints = parsePaths(petstore);
    const result = countEndpoints(endpoints);

    expect(result.total).toBe(12);
    expect(result.byTag['pet']).toBe(5);
    expect(result.byTag['store']).toBe(3);
    expect(result.byTag['user']).toBe(4);
  });

  it('total equals sum of all byTag counts', () => {
    const endpoints = parsePaths(petstore);
    const result = countEndpoints(endpoints);
    const sum = Object.values(result.byTag).reduce((acc, n) => acc + n, 0);
    expect(result.total).toBe(sum);
  });

  it('handles single endpoint', () => {
    const result = countEndpoints([
      {
        name: 'Pet_addPet', method: 'POST', path: '/pet',
        tag: 'pet', responseType: 'any', pathParams: [], queryParams: [],
      },
    ]);
    expect(result.total).toBe(1);
    expect(result.byTag['pet']).toBe(1);
  });

  it('counts multiple endpoints in the same tag', () => {
    const result = countEndpoints([
      { name: 'Pet_addPet',    method: 'POST', path: '/pet',  tag: 'pet', responseType: 'any', pathParams: [], queryParams: [] },
      { name: 'Pet_updatePet', method: 'PUT',  path: '/pet',  tag: 'pet', responseType: 'any', pathParams: [], queryParams: [] },
      { name: 'Store_getInv',  method: 'GET',  path: '/store',tag: 'store',responseType: 'any', pathParams: [], queryParams: [] },
    ]);
    expect(result.total).toBe(3);
    expect(result.byTag['pet']).toBe(2);
    expect(result.byTag['store']).toBe(1);
  });
});