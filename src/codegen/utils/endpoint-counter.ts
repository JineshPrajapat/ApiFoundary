import type { ParsedEndpoint } from '../../types/openapi.ts';

/**
 * Counts endpoints by tag and overall.
 *
 * Returns an object:
 * {
 *   total: number,
 *   byTag: {
 *     'manager/auth': 3,
 *     'user/profile': 5
 *   }
 * }
 */
export function countEndpoints(endpoints: ParsedEndpoint[]) {
  const byTag: Record<string, number> = {};

  for (const ep of endpoints) {
    byTag[ep.tag] = (byTag[ep.tag] ?? 0) + 1;
  }

  return {
    total: endpoints.length,
    byTag,
  };
}