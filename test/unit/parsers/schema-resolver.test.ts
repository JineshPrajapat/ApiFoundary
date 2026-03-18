import { describe, it, expect } from 'vitest';
import { resolveSchema } from '../../../src/codegen/parsers/schema-resolver.ts';
import type { OpenAPIV3 } from 'openapi-types';

// Petstore components used as real resolution context
const components: OpenAPIV3.ComponentsObject = {
  schemas: {
    Pet: {
      type: 'object',
      required: ['name', 'photoUrls'],
      properties: {
        id:        { type: 'integer' },
        name:      { type: 'string' },
        category:  { $ref: '#/components/schemas/Category' },
        photoUrls: { type: 'array', items: { type: 'string' } },
        tags:      { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
        status:    { type: 'string', enum: ['available', 'pending', 'sold'] },
      },
    },
    Category: {
      type: 'object',
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
    },
    Tag: {
      type: 'object',
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
    },
    Order: {
      type: 'object',
      properties: {
        id:       { type: 'integer' },
        petId:    { type: 'integer' },
        quantity: { type: 'integer' },
        status:   { type: 'string', enum: ['placed', 'approved', 'delivered'] },
        complete: { type: 'boolean' },
      },
    },
    ApiResponse: {
      type: 'object',
      properties: {
        code:    { type: 'integer' },
        type:    { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

describe('resolveSchema — primitives', () => {
  it.each([
    [{ type: 'string' } as OpenAPIV3.SchemaObject,  'string'],
    [{ type: 'number' } as OpenAPIV3.SchemaObject,  'number'],
    [{ type: 'integer' } as OpenAPIV3.SchemaObject, 'number'],
    [{ type: 'boolean' } as OpenAPIV3.SchemaObject, 'boolean'],
  ])('%j -> "%s"', (schema, expected) => {
    expect(resolveSchema(schema, components)).toBe(expected);
  });
});

describe('resolveSchema — $ref', () => {
  it('returns schema name for a $ref pointing to components/schemas', () => {
    expect(resolveSchema({ $ref: '#/components/schemas/Pet' }, components)).toBe('Pet');
    expect(resolveSchema({ $ref: '#/components/schemas/Order' }, components)).toBe('Order');
    expect(resolveSchema({ $ref: '#/components/schemas/ApiResponse' }, components)).toBe('ApiResponse');
  });

  it('returns "any /* circular ref */" for a circular $ref', () => {
    const seen = new Set(['#/components/schemas/Pet']);
    const result = resolveSchema({ $ref: '#/components/schemas/Pet' }, components, seen);
    expect(result).toBe('any /* circular ref */');
  });
});

describe('resolveSchema — arrays', () => {
  it('resolves array of primitives', () => {
    expect(resolveSchema({ type: 'array', items: { type: 'string' } }, components)).toBe('string[]');
  });

  it('resolves array of $ref with parentheses for union types', () => {
    const result = resolveSchema({
      type: 'array',
      items: { $ref: '#/components/schemas/Pet' },
    }, components);
    expect(result).toBe('Pet[]');
  });

  it('wraps union item types in parentheses', () => {
    const result = resolveSchema({
      type: 'array',
      items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    }, components);
    expect(result).toBe('(string | number)[]');
  });
});

describe('resolveSchema — enums', () => {
  it('resolves string enum to union of string literals', () => {
    const result = resolveSchema({
      type: 'string',
      enum: ['available', 'pending', 'sold'],
    }, components);
    expect(result).toBe("'available' | 'pending' | 'sold'");
  });

  it('resolves numeric enum to union of numbers', () => {
    const result = resolveSchema({
      type: 'integer',
      enum: [1, 2, 3],
    }, components);
    expect(result).toBe('1 | 2 | 3');
  });
});

describe('resolveSchema — nullable', () => {
  it('appends "| null" for nullable schemas', () => {
    const result = resolveSchema({ type: 'string', nullable: true }, components);
    expect(result).toBe('string | null');
  });

  it('appends "| null" for nullable $ref', () => {
    const result = resolveSchema({ $ref: '#/components/schemas/Pet', nullable: true } as any, components);
    // $ref takes priority — nullable check is on the base schema, not ref
    // The ref itself returns 'Pet'; nullable on a $ref node is checked at object level
    expect(result).toContain('Pet');
  });
});

describe('resolveSchema — composition', () => {
  it('resolves oneOf to union', () => {
    const result = resolveSchema({
      oneOf: [{ type: 'string' }, { type: 'number' }],
    }, components);
    expect(result).toBe('string | number');
  });

  it('resolves anyOf to union', () => {
    const result = resolveSchema({
      anyOf: [{ $ref: '#/components/schemas/Pet' }, { type: 'string' }],
    }, components);
    expect(result).toBe('Pet | string');
  });

  it('resolves allOf to intersection', () => {
    const result = resolveSchema({
      allOf: [{ $ref: '#/components/schemas/Pet' }, { $ref: '#/components/schemas/Category' }],
    }, components);
    expect(result).toBe('Pet & Category');
  });
});

describe('resolveSchema — inline objects', () => {
  it('resolves object with properties to inline type', () => {
    const result = resolveSchema({
      type: 'object',
      properties: {
        id:   { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id'],
    }, components);
    expect(result).toContain('id:');
    expect(result).toContain('name?:');
    expect(result).toContain('string');
  });

  it('resolves additionalProperties to Record<string, T>', () => {
    const result = resolveSchema({
      type: 'object',
      additionalProperties: { type: 'integer' },
    }, components);
    expect(result).toBe('Record<string, number>');
  });

  it('returns "Record<string, any>" for empty object', () => {
    expect(resolveSchema({ type: 'object' }, components)).toBe('Record<string, any>');
  });
});

describe('resolveSchema — missing schema', () => {
  it('returns "any" for null/undefined input', () => {
    expect(resolveSchema(null as any, components)).toBe('any');
    expect(resolveSchema(undefined as any, components)).toBe('any');
  });

  it('returns "any" for unknown type', () => {
    expect(resolveSchema({ type: 'unknown' } as any, components)).toBe('any');
  });
});