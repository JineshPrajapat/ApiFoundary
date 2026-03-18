import { describe, it, expect } from 'vitest';
import { parseSchemas } from '../../../src/codegen/parsers/schema-parser.ts';
import type { OpenAPIV3 } from 'openapi-types';
import petstoreSpec from '../../fixtures/petstore.json';

const spec = petstoreSpec as unknown as OpenAPIV3.Document;

describe('parseSchemas — Petstore', () => {
  const schemas = parseSchemas(spec);
  const byName = Object.fromEntries(schemas.map((s) => [s.name, s]));
  const names  = schemas.map((s) => s.name);

  it('parses all 6 schemas from Petstore', () => {
    expect(schemas).toHaveLength(6);
  });

  it('includes all expected schema names', () => {
    expect(names).toContain('Order');
    expect(names).toContain('Category');
    expect(names).toContain('User');
    expect(names).toContain('Tag');
    expect(names).toContain('Pet');
    expect(names).toContain('ApiResponse');
  });

  describe('Pet schema', () => {
    it('type is "object"', () => {
      expect(byName['Pet']?.type).toBe('object');
    });

    it('has required fields: name, photoUrls', () => {
      expect(byName['Pet']?.required).toContain('name');
      expect(byName['Pet']?.required).toContain('photoUrls');
    });

    it('has all expected properties', () => {
      const props = byName['Pet']?.properties ?? {};
      expect(Object.keys(props)).toContain('id');
      expect(Object.keys(props)).toContain('name');
      expect(Object.keys(props)).toContain('category');
      expect(Object.keys(props)).toContain('photoUrls');
      expect(Object.keys(props)).toContain('status');
    });

    it('resolves $ref property (category) to its schema name', () => {
      expect(byName['Pet']?.properties?.['category']).toBe('Category');
    });

    it('resolves array of string (photoUrls) correctly', () => {
      expect(byName['Pet']?.properties?.['photoUrls']).toBe('string[]');
    });

    it('resolves enum property (status) to union of literals', () => {
      expect(byName['Pet']?.properties?.['status']).toContain("'available'");
      expect(byName['Pet']?.properties?.['status']).toContain("'pending'");
      expect(byName['Pet']?.properties?.['status']).toContain("'sold'");
    });
  });

  describe('Order schema', () => {
    it('type is "object"', () => {
      expect(byName['Order']?.type).toBe('object');
    });

    it('has no required fields (all optional)', () => {
      expect(byName['Order']?.required ?? []).toHaveLength(0);
    });

    it('resolves enum property (status) to union', () => {
      const status = byName['Order']?.properties?.['status'];
      expect(status).toContain("'placed'");
      expect(status).toContain("'approved'");
      expect(status).toContain("'delivered'");
    });

    it('resolves boolean property (complete) to "boolean"', () => {
      expect(byName['Order']?.properties?.['complete']).toBe('boolean');
    });
  });

  describe('User schema', () => {
    it('has all user properties', () => {
      const props = Object.keys(byName['User']?.properties ?? {});
      expect(props).toContain('id');
      expect(props).toContain('username');
      expect(props).toContain('email');
      expect(props).toContain('userStatus');
    });
  });

  describe('ApiResponse schema', () => {
    it('has code, type, message properties', () => {
      const props = byName['ApiResponse']?.properties ?? {};
      expect(props['code']).toBe('number');
      expect(props['type']).toBe('string');
      expect(props['message']).toBe('string');
    });
  });
});

describe('parseSchemas — empty spec', () => {
  it('returns empty array when no schemas defined', () => {
    const emptySpec = {
      openapi: '3.0.0',
      info: { title: 'Empty', version: '1.0.0' },
      paths: {},
    } as OpenAPIV3.Document;
    expect(parseSchemas(emptySpec)).toEqual([]);
  });
});

describe('parseSchemas — enum schema', () => {
  it('parses top-level enum schema correctly', () => {
    const enumSpec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1' },
      paths: {},
      components: {
        schemas: {
          Status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
        },
      },
    };
    const schemas = parseSchemas(enumSpec);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('Status');
    expect(schemas[0]?.enumValues).toEqual(['active', 'inactive', 'pending']);
  });
});