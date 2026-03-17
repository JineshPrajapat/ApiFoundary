import type { OpenAPIV3 } from 'openapi-types';
import type { ParsedSchema } from '../../types/openapi.ts';
import { resolveSchema } from './schema-resolver.ts';

export function parseSchemas(spec: OpenAPIV3.Document): ParsedSchema[] {
  const schemas = spec.components?.schemas ?? {};
  return Object.entries(schemas).map(([name, schema]) =>
    parseSchema(name, schema as OpenAPIV3.SchemaObject, spec.components),
  );
}

function parseSchema(
  name: string,
  schema: OpenAPIV3.SchemaObject,
  components?: OpenAPIV3.ComponentsObject,
): ParsedSchema {
  if (schema.enum) {
    return { name, type: schema.type ?? 'string', enumValues: schema.enum };
  }

  if (schema.type === 'object' && schema.properties) {
    const properties: Record<string, string> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = resolveSchema(value as OpenAPIV3.SchemaObject, components);
    }
    return { name, type: 'object', properties, required: schema.required ?? [] };
  }

  return { name, type: schema.type ?? null };
}