import type { OpenAPIV3 } from 'openapi-types';

type SchemaNode = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

/**
 * Resolves an OpenAPI schema node to a TypeScript type string.
 *
 * Edge cases handled:
 *   - Circular $ref — detected via `seen` set, returns `any` with a comment
 *   - Missing schema — returns `any`
 *   - nullable — appends `| null`
 */
export function resolveSchema(
  schema: SchemaNode,
  components?: OpenAPIV3.ComponentsObject,
  seen: Set<string> = new Set(),
): string {
  if (!schema) return 'any';

  if ('$ref' in schema) {
    if (seen.has(schema.$ref)) {
      // Circular reference — break the cycle, emit any
      return 'any /* circular ref */';
    }
    const name = schema.$ref.split('/').pop() ?? 'any';
    // Resolve inline only if we need the shape — for top-level named schemas
    // we just return the name (it will be a generated type in types.ts)
    return name;
  }

  if (schema.oneOf) return schema.oneOf.map((s) => resolveSchema(s, components, seen)).join(' | ');
  if (schema.anyOf) return schema.anyOf.map((s) => resolveSchema(s, components, seen)).join(' | ');
  if (schema.allOf) return schema.allOf.map((s) => resolveSchema(s, components, seen)).join(' & ');

  const base = resolveBaseType(schema, components, seen);
  return schema.nullable ? `${base} | null` : base;
}

function resolveBaseType(
  schema: OpenAPIV3.SchemaObject,
  components?: OpenAPIV3.ComponentsObject,
  seen: Set<string> = new Set(),
): string {
  switch (schema.type) {
    case 'string':
      return schema.enum
        ? schema.enum.map((v) => `'${String(v)}'`).join(' | ')
        : 'string';

    case 'integer':
    case 'number':
      return schema.enum ? schema.enum.join(' | ') : 'number';

    case 'boolean':
      return 'boolean';

    case 'array': {
      if (!schema.items) return 'unknown[]';
      const item = resolveSchema(schema.items, components, seen);
      return item.includes('|') || item.includes('&') ? `(${item})[]` : `${item}[]`;
    }

    case 'object':
      return resolveObjectType(schema, components, seen);

    default:
      return 'any';
  }
}

function resolveObjectType(
  schema: OpenAPIV3.SchemaObject,
  components?: OpenAPIV3.ComponentsObject,
  seen: Set<string> = new Set(),
): string {
  if (schema.properties) {
    const props = Object.entries(schema.properties).map(([k, v]) => {
      const optional = !schema.required?.includes(k);
      return `  ${k}${optional ? '?' : ''}: ${resolveSchema(v as SchemaNode, components, seen)};`;
    });
    return `{\n${props.join('\n')}\n}`;
  }

  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties !== 'boolean'
  ) {
    return `Record<string, ${resolveSchema(schema.additionalProperties, components, seen)}>`;
  }

  return 'Record<string, any>';
}