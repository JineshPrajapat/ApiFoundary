import type { HttpAdapter, RequestDescriptor, EndpointFn, EndpointTree } from './contracts.ts';

type EndpointModule = Record<string, (...args: never[]) => RequestDescriptor>;

type InferResponse<D> = D extends RequestDescriptor<infer R> ? R : never;

/**
 * BoundTree<T> — recursively maps an EndpointTree to async functions.
 *
 * For each key in T:
 *   - If the value is an EndpointFn  → async function with matching params + return type
 *   - If the value is an EndpointTree → recursively bound nested object
 *
 * Examples:
 *
 *   // Flat module
 *   BoundTree<{ GetAccounts: () => RD<AccountsResponse> }>
 *   = { GetAccounts: () => Promise<AccountsResponse> }
 *
 *   // Nested module (api.ts structure)
 *   BoundTree<{ accounts: { GetAccounts: () => RD<AccountsResponse> } }>
 *   = { accounts: { GetAccounts: () => Promise<AccountsResponse> } }
 *
 *   // Mixed: parent has own endpoints + children
 *   BoundTree<{ manager: { GetDetails: () => RD<X>; auth: { Login: () => RD<Y> } } }>
 *   = { manager: { GetDetails: () => Promise<X>; auth: { Login: () => Promise<Y> } } }
 */
export type BoundTree<T extends EndpointTree> = {
  [K in keyof T]: T[K] extends EndpointFn
    ? (...args: Parameters<T[K]>) => Promise<InferResponse<ReturnType<T[K]>>>
    : T[K] extends EndpointTree
    ? BoundTree<T[K]>
    : never;
};


/**
 * Transforms an EndpointTree into a BoundTree by wiring every leaf
 * EndpointFn to the adapter, and recursing into nested namespaces.
 *
 * Before:
 *   const desc = accounts.Accounts_GetAccounts();   // returns a descriptor
 *   const data = await adapter.execute(desc);        // executes it
 *
 * After (via bindApi):
 *   const data = await api.accounts.Accounts_GetAccounts();  // one call
 *
 * The runtime check `typeof val === 'function'` distinguishes leaf functions
 * from nested namespace objects. Both branches are handled recursively.
 */
export function bindApi<T extends EndpointTree>(
  endpoints: T,
  adapter: HttpAdapter,
): BoundTree<T> {
  const bound = {} as BoundTree<T>;
 
  for (const key in endpoints) {
    const val: EndpointFn | EndpointTree | undefined = endpoints[key];
 
    // noUncheckedIndexedAccess guard
    if (val === undefined) continue;
 
    if (typeof val === 'function') {
      // Leaf: bind the endpoint function to the adapter
      (bound as Record<string, unknown>)[key] = (...args: never[]) =>
        adapter.execute((val as EndpointFn)(...args));
    } else {
      // Namespace: recurse into the nested object
      (bound as Record<string, unknown>)[key] = bindApi(
        val as EndpointTree,
        adapter,
      );
    }
  }
 
  return bound;
}


// ── Legacy flat export for backwards compatibility ──────────────────────────
// Projects that were using the old flat BoundApi<T> type can migrate gradually.
// BoundApi is now an alias for BoundTree when T is a flat module.
 
type FlatEndpointModule = Record<string, EndpointFn>;
 
/** @deprecated Use BoundTree<T> instead. Will be removed in v2. */
export type BoundApi<T extends FlatEndpointModule> = BoundTree<T>;