import type { ClientConfig } from './client-config.ts';
import type { EndpointTree } from './contracts.ts';
import type { BoundTree } from './bind-api.ts';
import { resolveAdapter } from './adapter-resolver.ts';
import { bindApi } from './bind-api.ts';

/**
 * Creates a fully typed, ready-to-use API client.
 *
 * Accepts any EndpointTree — flat or nested — and returns a BoundTree
 * where every endpoint function is an async function returning the
 * correct typed Promise.
 *
 * @example Flat (single-level tags)
 *   export const api = createClient(
 *     { ...accounts, ...cards },
 *     { baseUrl: 'https://api.example.com' },
 *   );
 *   api.Accounts_GetAccounts()  // -> Promise<AccountsResponse>
 *
 * @example Nested (multi-level tags — generated api.ts format)
 *   export const api = createClient(
 *     {
 *       accounts: { ...accounts },
 *       cards:    { ...cards },
 *       manager: {
 *         ...manager,
 *         auth: { ...manager_auth },
 *       },
 *     },
 *     { baseUrl: 'https://api.example.com' },
 *   );
 *   api.accounts.Accounts_GetAccounts()        // -> Promise<AccountsResponse>
 *   api.manager.auth.ManagerAuth_Login()       // -> Promise<LoginResponse>
 *
 * @example Axios instance
 *   export const api = createClient({ ...accounts }, { axiosInstance });
 *
 * @example Custom adapter
 *   const adapter: HttpAdapter = { execute: async (d) => { ... } };
 *   export const api = createClient({ ...accounts }, { adapter });
 */
export function createClient<T extends EndpointTree>(
  endpoints: T,
  config: ClientConfig,
): BoundTree<T> {
  return bindApi(endpoints, resolveAdapter(config));
}