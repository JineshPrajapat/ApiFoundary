// src/core/resolve-schema.ts
import { OpenAPIV3 } from 'openapi-types';

export function resolveSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  components: OpenAPIV3.ComponentsObject | undefined,
): string {
  if (!schema) return 'any';

  if ('$ref' in schema) {
    const refName = schema.$ref.split('/').pop();
    return refName || 'any';
  }

  let baseType = 'any';

  if (schema.oneOf) {
    baseType = schema.oneOf.map(s => resolveSchema(s, components)).join(' | ');
  } else if (schema.anyOf) {
    baseType = schema.anyOf.map(s => resolveSchema(s, components)).join(' | ');
  } else if (schema.allOf) {
    baseType = schema.allOf.map(s => resolveSchema(s, components)).join(' & ');
  } else {
    switch (schema.type) {
      case 'string':
        baseType = schema.enum
          ? schema.enum.map(v => `'${v}'`).join(' | ')
          : 'string';
        break;
      case 'number':
      case 'integer':
        baseType = schema.enum
          ? schema.enum.join(' | ')
          : 'number';
        break;
      case 'boolean':
        baseType = 'boolean';
        break;
      case 'array':
        const itemType = resolveSchema(schema.items!, components);
        baseType =
          itemType.includes('|') || itemType.includes('&')
            ? `(${itemType})[]`
            : `${itemType}[]`;
        break;
      case 'object':
        if (schema.properties) {
          const props = Object.entries(schema.properties).map(
            ([key, value]) => {
              const required = schema.required?.includes(key);
              const type = resolveSchema(value as any, components);
              return `  ${key}${required ? '' : '?'}: ${type};`;
            },
          );
          baseType = `{\n${props.join('\n')}\n}`;
        } else if (schema.additionalProperties) {
          if (typeof schema.additionalProperties === 'boolean') {
            baseType = 'Record<string, any>';
          } else {
            baseType = `Record<string, ${resolveSchema(
              schema.additionalProperties,
              components,
            )}>`;
          }
        } else {
          baseType = 'Record<string, any>';
        }
        break;
      default:
        baseType = 'any';
    }
  }

  if (schema.nullable) {
    baseType = `${baseType} | null`;
  }

  return baseType;
}