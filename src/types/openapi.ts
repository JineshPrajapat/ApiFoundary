import type { OpenAPIV3 } from 'openapi-types';

export type { OpenAPIV3 };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ParsedSchema {
  name: string;
  type: string | null;
  properties?: Record<string, string>;
  required?: string[];
  enumValues?: unknown[];
}

export interface ParsedEndpoint {
  name: string;
  method: HttpMethod;
  path: string;
  tag: string;
  requestBodyType?: string;
  responseType: string;
  pathParams: Array<{ name: string; type: string }>;
  queryParams: Array<{ name: string; type: string; required: boolean }>;
}

/** filePath → file content map handed to the writer */
export type FileMap = Record<string, string>;

export interface CodegenOptions {
  /** Write one endpoint file per OpenAPI tag */
  splitByTag: boolean;
  /** Subdirectory inside output where SDK files land, e.g. 'api' → src/api/ */
  sdkDir: string;
  verbose?: boolean;
}