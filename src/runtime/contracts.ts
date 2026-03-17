// /**
//  * ApiFoundry Runtime Contracts
//  *
//  * These are the only interfaces shared between:
//  *   - Generated code  (depends on RequestDescriptor)
//  *   - Adapters        (implement HttpAdapter)
//  *   - createClient()  (depends on both)
//  *
//  * No implementations. No classes. Interfaces only.
//  * Every concrete file depends on this — this depends on nothing.
//  */

// /** All HTTP methods supported by OpenAPI 3.x */
// export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// /**
//  * A plain, serialisable description of a single HTTP call.
//  *
//  * Generated endpoint builders return this. They do not execute anything.
//  * TResponse is a phantom type: erased at runtime, used by TypeScript to
//  * infer the correct Promise return type through bindApi().
//  */
// export interface RequestDescriptor<TResponse = unknown> {
//   readonly method: HttpMethod;
//   readonly path: string;
//   readonly body?: unknown;
//   readonly query?: Record<string, unknown>;
//   /** Phantom — never assigned at runtime. Exists only for type inference. */
//   readonly _response?: TResponse;
// }

// /** Standardised HTTP response envelope */
// export interface ApiResponse<T = unknown> {
//   data: T;
//   status: number;
//   headers: Record<string, string>;
// }

// /**
//  * The single contract every adapter must implement.
//  * One method: receive a descriptor, return a typed Promise.
//  */
// export interface HttpAdapter {
//   execute<TResponse>(descriptor: RequestDescriptor<TResponse>): Promise<TResponse>;
// }

// /**
//  * Minimal Axios-compatible interface.
//  * Kept structurally typed (not importing axios) so axios remains optional.
//  */
// export interface AxiosLike {
//   request<T>(config: AxiosRequestConfig): Promise<AxiosResponseLike<T>>;
// }

// export interface AxiosRequestConfig {
//   method: string;
//   url: string;
//   data?: unknown;
//   params?: unknown;
//   headers?: Record<string, string>;
//   signal?: AbortSignal;
// }

// export interface AxiosResponseLike<T> {
//   data: T;
//   status: number;
//   headers: Record<string, string>;
// }


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