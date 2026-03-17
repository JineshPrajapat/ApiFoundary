// import type { HttpAdapter, RequestDescriptor } from './contracts.ts';

// type EndpointModule = Record<string, (...args: never[]) => RequestDescriptor>;

// /** Extracts TResponse phantom from RequestDescriptor<TResponse> */
// type InferResponse<D> = D extends RequestDescriptor<infer R> ? R : never;

// /**
//  * Maps a module of descriptor builders to directly callable async functions.
//  * Parameters and return types are fully preserved via mapped types.
//  *
//  * Before: adapter.execute(ListUsers({ limit: 10 }))  → Promise<UsersResponse>
//  * After:  api.ListUsers({ limit: 10 })               → Promise<UsersResponse>
//  */
// export type BoundApi<T extends EndpointModule> = {
//   [K in keyof T]: (...args: Parameters<T[K]>) => Promise<InferResponse<ReturnType<T[K]>>>;
// };

// export function bindApi<T extends EndpointModule>(
//   endpoints: T,
//   adapter: HttpAdapter,
// ): BoundApi<T> {
//   const bound = {} as BoundApi<T>;

//   for (const key in endpoints) {
//     (bound as Record<string, unknown>)[key] = (...args: never[]) =>
//       adapter.execute(endpoints[key](...args));
//   }

//   return bound;
// }


import type { HttpAdapter, RequestDescriptor } from './contracts.ts';

type EndpointModule = Record<string, (...args: never[]) => RequestDescriptor>;

type InferResponse<D> = D extends RequestDescriptor<infer R> ? R : never;

export type BoundApi<T extends EndpointModule> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Promise<InferResponse<ReturnType<T[K]>>>;
};

/**
 * Transforms descriptor builders into directly callable async functions.
 * Parameters and return types are fully preserved.
 *
 * Before: adapter.execute(ListUsers({ limit: 10 })) → Promise<UsersResponse>
 * After:  api.ListUsers({ limit: 10 })              → Promise<UsersResponse>
 */
export function bindApi<T extends EndpointModule>(
  endpoints: T,
  adapter: HttpAdapter,
): BoundApi<T> {
  const bound = {} as BoundApi<T>;
  for (const key in endpoints) {
    (bound as Record<string, unknown>)[key] = (...args: never[]) =>
      adapter.execute(endpoints[key](...args));
  }
  return bound;
}