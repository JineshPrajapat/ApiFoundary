import { OpenAPIV3 } from 'openapi-types';
import { resolveSchema } from './resolve-schema.ts';

export interface ParsedSchema {
  name: string;

  // one of these will define the shape
  type: string | null;                // "object" | "string" | "number" | etc
  properties?: Record<string, string>;
  required?: string[];
  enumValues?: unknown[];

  // fallback (for unions / complex resolve cases)
  typeContent?: string;
}

export function parseSchemas(
  spec: OpenAPIV3.Document,
): ParsedSchema[] {
  const schemas = spec.components?.schemas || {};

  return Object.entries(schemas).map(([name, schema]) => {
    const resolved = schema as OpenAPIV3.SchemaObject;

    // ENUM
    if (resolved.enum) {
      return {
        name,
        type: resolved.type ?? 'string',
        enumValues: resolved.enum,
      };
    }

    // OBJECT
    if (resolved.type === 'object' && resolved.properties) {
      const properties: Record<string, string> = {};

      for (const [key, value] of Object.entries(
        resolved.properties,
      )) {
        properties[key] = resolveSchema(
          value as any,
          spec.components,
        );
      }

      return {
        name,
        type: 'object',
        properties,
        required: resolved.required ?? [],
      };
    }

    // PRIMITIVE / ARRAY / UNION (fallback)
    return {
      name,
      type: resolved.type ?? null,
      typeContent: resolveSchema(resolved, spec.components),
    };
  });
}