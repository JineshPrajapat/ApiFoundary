import fs from 'fs-extra';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Loads and validates an OpenAPI 3.x JSON document from a file path or URL.
 *
 * Edge cases handled:
 *   - Remote fetch failure → clear HTTP status error
 *   - YAML spec → detected and reported explicitly (YAML not supported in MVP)
 *   - Invalid JSON → clear parse error
 *   - Non-OpenAPI JSON → clear version error
 *   - OpenAPI 2.x (Swagger) → detected and reported
 */
export async function loadSpec(input: string): Promise<OpenAPIV3.Document> {
  const content = await fetchContent(input);
  return parseAndValidate(content, input);
}

async function fetchContent(input: string): Promise<string> {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    const res = await fetch(input);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec from ${input}\n` +
        `HTTP ${res.status}: ${res.statusText}`,
      );
    }
    return res.text();
  }

  const exists = await fs.pathExists(input);
  if (!exists) {
    throw new Error(`OpenAPI spec file not found: ${input}`);
  }

  return fs.readFile(input, 'utf-8');
}

function parseAndValidate(content: string, input: string): OpenAPIV3.Document {
  const trimmed = content.trimStart();

  // Detect YAML before attempting JSON parse — gives a clear error instead of
  // a confusing "Unexpected token" message
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error(
      `The spec at "${input}" appears to be YAML.\n` +
      `ApiFoundry currently supports JSON only. Convert with:\n` +
      `  npx js-yaml openapi.yaml > openapi.json`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`The spec at "${input}" is not valid JSON.`);
  }

  const doc = parsed as Record<string, unknown>;

  if (typeof doc?.swagger === 'string') {
    throw new Error(
      `The spec at "${input}" is OpenAPI 2.x (Swagger).\n` +
      `ApiFoundry supports OpenAPI 3.x only. Convert at: https://editor.swagger.io`,
    );
  }

  if (typeof doc?.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw new Error(
      `The spec at "${input}" is not a valid OpenAPI 3.x document.\n` +
      `Expected an "openapi" field starting with "3.". Got: ${String(doc?.openapi ?? 'missing')}`,
    );
  }

  return parsed as OpenAPIV3.Document;
}