/**
 * ApiFoundry Runtime Contracts
 *
 * Interfaces only. No implementations. Depends on nothing.
 * Every other runtime file depends on this — this depends on nothing.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A plain, serialisable description of a single HTTP call.
 * Generated endpoint builders return this — they never execute anything.
 *
 * TResponse is a phantom type: erased at runtime, preserved by TypeScript
 * so bindApi() can infer the correct Promise<T> return type.
 */
export interface RequestDescriptor<TResponse = unknown> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly query?: Record<string, unknown>;
  /** Phantom — never assigned at runtime. Exists only for type inference. */
  readonly _response?: TResponse;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * The one contract every adapter must fulfil.
 * receive a descriptor → return a typed Promise.
 */
export interface HttpAdapter {
  execute<TResponse>(descriptor: RequestDescriptor<TResponse>): Promise<TResponse>;
}

/**
 * A single endpoint function — takes any arguments, returns a RequestDescriptor.
 * This is the leaf-node type in an EndpointTree.
 */
export type EndpointFn = (...args: never[]) => RequestDescriptor<unknown>;

/**
 * A recursive tree of endpoint functions and nested namespaces.
 *
 * This is what createClient() accepts:
 *
 *   // Flat (single-level tags):
 *   createClient({ ...accounts, ...cards }, config)
 *
 *   // Nested (multi-level tags like manager/auth):
 *   createClient({
 *     accounts: { ...accounts },
 *     manager: {
 *       ...manager,
 *       auth: { ...manager_auth },
 *     },
 *   }, config)
 *
 * Both forms satisfy EndpointTree.
 */
export type EndpointTree = {
  [key: string]: EndpointFn | EndpointTree;
};

/**
 * Minimal structural Axios interface.
 * Structurally typed so axios remains an optional peer dependency.
 */
export interface AxiosLike {
  request<T>(config: {
    method: string;
    url: string;
    data?: unknown;
    params?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }): Promise<{ data: T; status: number; headers: Record<string, string> }>;
}