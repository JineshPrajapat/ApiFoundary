/**
 * identifier.ts — Single source of truth for all naming transforms.
 *
 * EVERY file that converts a tag, operationId, or schema name into a
 * TypeScript identifier MUST import from here. Never reimplement locally.
 *
 * Naming convention used throughout ApiFoundry:
 *   - File names:    camelCase segments joined by /   e.g. api/manager/pingServer.ts
 *   - Import vars:   segments joined by _             e.g. manager_pingServer
 *   - Object keys:   last segment (camelCase)         e.g. pingServer
 *   - Function names: PascalTagPrefix + _ + action   e.g. ManagerAuth_loginUser
 *   - Schema names:  raw name with non-alphanum -> _  e.g. Login_Response
 */

// ---------------------------------------------------------------------------
// Reserved JS/TS words that cannot be used as identifiers or object keys
// ---------------------------------------------------------------------------
const JS_RESERVED = new Set([
  'break','case','catch','class','const','continue','debugger','default',
  'delete','do','else','export','extends','finally','for','function','if',
  'import','in','instanceof','let','new','return','static','super','switch',
  'this','throw','try','typeof','var','void','while','with','yield',
  'abstract','as','async','await','declare','enum','from','implements',
  'interface','is','keyof','module','namespace','never','of','readonly',
  'require','type','undefined','unique','unknown',
]);

/**
 * Map of reserved words to safe replacements.
 * Applied when a tag segment or derived identifier collides with a JS keyword.
 */
const RESERVED_REMAP: Record<string, string> = {
  default:   'general',
  import:    'imports',
  export:    'exports',
  class:     'classes',
  return:    'returns',
  delete:    'deleteOp',
  in:        'inOp',
  new:       'newOp',
  this:      'thisOp',
  void:      'voidOp',
  type:      'typeOp',
  interface: 'iface',
  module:    'mod',
  namespace: 'ns',
};

// ---------------------------------------------------------------------------
// Tag segment normalisation
// ---------------------------------------------------------------------------

/**
 * Converts a single raw tag segment to a safe camelCase identifier part.
 *
 * Examples:
 *   'auth'           -> 'auth'
 *   'ping-server'    -> 'pingServer'     (dashes become camelCase)
 *   'user_details'   -> 'userDetails'    (underscores become camelCase)
 *   'feesgroup'      -> 'feesgroup'      (already clean)
 *   'default'        -> 'general'        (reserved word remapped)
 *   'ADMIN'          -> 'admin'          (lowercased first)
 */
export function segmentToCamelPart(seg: string): string {
  // Lowercase, then camelCase on separator boundaries
  let s = seg.toLowerCase();
  s = s.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
  // Strip remaining invalid chars
  s = s.replace(/[^a-zA-Z0-9]/g, '');
  if (!s) s = 'unknown';
  // Remap reserved words
  return RESERVED_REMAP[s] ?? s;
}

/**
 * Converts a raw OpenAPI tag string into a list of clean camelCase segments.
 *
 * Examples:
 *   'manager/auth'       -> ['manager', 'auth']
 *   'default'            -> ['general']
 *   'ping-server'        -> ['pingServer']
 *   'user/cryptoexchange'-> ['user', 'cryptoexchange']
 */
export function tagToSegments(tag: string): string[] {
  return tag
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(segmentToCamelPart);
}

/**
 * Converts tag segments to a file path (no dashes, no reserved words).
 *
 *   ['manager', 'auth']  -> 'manager/auth'   (used as api/manager/auth.ts)
 *   ['general']          -> 'general'         (was 'default' -> invalid)
 *   ['pingServer']       -> 'pingServer'       (was 'ping-server' -> invalid)
 */
export function segmentsToFilePath(segments: string[]): string {
  return segments.join('/');
}

/**
 * Converts tag segments to a valid JS import variable name.
 *
 *   ['manager', 'auth']  -> 'manager_auth'
 *   ['general']          -> 'general'
 *   ['pingServer']       -> 'pingServer'
 */
export function segmentsToImportVar(segments: string[]): string {
  const joined = segments.join('_');
  // Ensure it starts with a letter or underscore
  return /^\d/.test(joined) ? `_${joined}` : joined;
}

/**
 * Converts tag segments to a PascalCase prefix for function names.
 *
 *   ['manager', 'auth']  -> 'ManagerAuth'
 *   ['general']          -> 'General'
 *   ['pingServer']       -> 'PingServer'
 */
export function segmentsToPascalPrefix(segments: string[]): string {
  return segments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

// ---------------------------------------------------------------------------
// Schema name normalisation
// ---------------------------------------------------------------------------

/**
 * Converts a raw schema name from the OpenAPI spec to a safe TypeScript
 * identifier.
 *
 * CRITICAL: This MUST be used identically in BOTH:
 *   - type-generator.ts  when emitting  `export interface LoginResponse_Dto`
 *   - endpoint-generator.ts when checking `schemas.has(name)`
 *
 * If they differ, `RequestDescriptor<Types.Foo>` silently becomes
 * `RequestDescriptor<any>` because the set lookup fails.
 *
 * Examples:
 *   'LoginResponseDto'   -> 'LoginResponseDto'   (clean, no change)
 *   'Login.Response'     -> 'Login_Response'     (dot -> underscore)
 *   'Foo-Bar'            -> 'Foo_Bar'            (dash -> underscore)
 *   '123Schema'          -> '_123Schema'         (starts with digit)
 */
export function sanitizeSchemaName(name: string): string {
  let s = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^\d/.test(s)) s = `_${s}`;
  return s;
}

/**
 * Extracts and sanitizes a schema name from a $ref string.
 *
 *   '#/components/schemas/LoginResponse.Dto' -> 'LoginResponse_Dto'
 */
export function refToSchemaName(ref: string): string {
  const raw = ref.split('/').pop() ?? 'unknown';
  return sanitizeSchemaName(raw);
}

// ---------------------------------------------------------------------------
// Function / operationId normalisation
// ---------------------------------------------------------------------------

/**
 * Extracts the action part from a NestJS-style operationId.
 * Strips the controller class prefix which is redundant (already in the tag).
 *
 *   'FeesGroupController_updateFeesGroupSettings' -> 'updateFeesGroupSettings'
 *   'AuthController_loginUser'                   -> 'loginUser'
 *   'loginUser'                                  -> 'loginUser'  (no prefix)
 */
export function extractAction(operationId: string): string {
  if (!operationId.includes('_')) return operationId;
  return operationId.split('_').slice(1).join('_');
}

/**
 * Sanitises a raw string into a valid TypeScript identifier.
 *
 *   'foo-bar baz'  -> 'fooBarBaz'
 *   'hello_world'  -> 'hello_world'
 *   '123abc'       -> '_123abc'
 */
export function sanitiseIdentifier(raw: string): string {
  let id = raw.replace(/[-\s.]+(.)/g, (_, c: string) => c.toUpperCase());
  id = id.replace(/[^a-zA-Z0-9_$]/g, '_');
  if (/^\d/.test(id)) id = `_${id}`;
  return id;
}