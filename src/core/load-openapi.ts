import fs from 'fs-extra';
import { OpenAPIV3 } from 'openapi-types';

export async function loadOpenAPI(input: string): Promise<OpenAPIV3.Document> {
  let content: string;

  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec from ${input}: ${response.statusText}`);
      }
      content = await response.text();
    } catch (error: any) {
      throw new Error(`Error fetching OpenAPI spec: ${error.message}`);
    }
  } else {
    try {
      content = await fs.readFile(input, 'utf-8');
    } catch (error: any) {
      throw new Error(`Error reading local OpenAPI file: ${error.message}`);
    }
  }

  let spec: any;
  try {
    spec = JSON.parse(content);
  } catch (error: any) {
    throw new Error(`Failed to parse OpenAPI spec as JSON: ${error.message}`);
  }

  if (!spec.openapi || !spec.openapi.startsWith('3.')) {
    throw new Error('Invalid OpenAPI spec. Only OpenAPI 3.x is supported.');
  }

  return spec as OpenAPIV3.Document;
}
