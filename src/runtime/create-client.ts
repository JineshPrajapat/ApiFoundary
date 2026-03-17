// import type { ClientConfig } from './client-config.ts';
// import type { BoundApi } from './bind-api.ts';
// import type { RequestDescriptor } from './contracts.ts';
// import { resolveAdapter } from './adapter-resolver.ts';
// import { bindApi } from './bind-api.ts';

// type EndpointModule = Record<string, (...args: never[]) => RequestDescriptor>;

// /**
//  * Creates a fully typed, ready-to-use API client.
//  *
//  * This function has one job: wire endpoints to an adapter.
//  * Adapter selection is handled entirely by resolveAdapter().
//  * HTTP execution is handled entirely by the adapter.
//  *
//  * @example — built-in fetch
//  *   export const api = createClient({ ...users }, { baseUrl: 'https://api.example.com' });
//  *
//  * @example — your Axios instance (keeps interceptors, auth, retry logic)
//  *   export const api = createClient({ ...users }, { axiosInstance });
//  *
//  * @example — fully custom adapter
//  *   export const api = createClient({ ...users }, { adapter: myAdapter });
//  */
// export function createClient<T extends EndpointModule>(
//   endpoints: T,
//   config: ClientConfig,
// ): BoundApi<T> {
//   const adapter = resolveAdapter(config);
//   return bindApi(endpoints, adapter);
// }


import type { ClientConfig } from './client-config.ts';
import type { BoundApi } from './bind-api.ts';
import type { RequestDescriptor } from './contracts.ts';
import { resolveAdapter } from './adapter-resolver.ts';
import { bindApi } from './bind-api.ts';

type EndpointModule = Record<string, (...args: never[]) => RequestDescriptor>;

/**
 * Creates a fully typed, ready-to-use API client.
 *
 * @example — built-in fetch
 *   export const api = createClient({ ...users }, { baseUrl: 'https://api.example.com' });
 *
 * @example — your Axios instance (keeps interceptors, auth, retry logic)
 *   export const api = createClient({ ...users }, { axiosInstance });
 *
 * @example — fully custom adapter
 *   export const api = createClient({ ...users }, { adapter: myAdapter });
 */
export function createClient<T extends EndpointModule>(
  endpoints: T,
  config: ClientConfig,
): BoundApi<T> {
  return bindApi(endpoints, resolveAdapter(config));
}