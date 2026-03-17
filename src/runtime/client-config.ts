// import type { HttpAdapter, AxiosLike } from './contracts.ts';

// /** Shared options available to all adapter types */
// interface BaseConfig {
//   /** Headers merged into every request */
//   headers?: Record<string, string>;
// }

// /** Use the built-in fetch adapter — zero extra dependencies */
// export interface FetchConfig extends BaseConfig {
//   /** Base URL prepended to every request path */
//   baseUrl: string;
//   /** Request timeout in ms. Default: 30000 */
//   timeout?: number;
// }

// /** Wrap your own Axios instance — keeps all your interceptors and auth */
// export interface AxiosConfig extends BaseConfig {
//   axiosInstance: AxiosLike;
// }

// /** Provide a fully custom adapter — complete control */
// export interface CustomAdapterConfig {
//   adapter: HttpAdapter;
// }

// /**
//  * ISP-compliant config: one type per adapter path.
//  * Consumers only see options relevant to what they've chosen.
//  */
// export type ClientConfig = FetchConfig | AxiosConfig | CustomAdapterConfig;

// // ── Type guards ───────────────────────────────────────────────────────────────

// export function isFetchConfig(c: ClientConfig): c is FetchConfig {
//   return 'baseUrl' in c;
// }

// export function isAxiosConfig(c: ClientConfig): c is AxiosConfig {
//   return 'axiosInstance' in c;
// }

// export function isCustomAdapterConfig(c: ClientConfig): c is CustomAdapterConfig {
//   return 'adapter' in c;
// }


import type { HttpAdapter, AxiosLike } from './contracts.ts';

interface BaseConfig {
  headers?: Record<string, string>;
}

/** Use the built-in fetch adapter — zero extra dependencies */
export interface FetchConfig extends BaseConfig {
  baseUrl: string;
  timeout?: number;
}

/** Wrap your own Axios instance — keeps interceptors, auth, retry logic */
export interface AxiosConfig extends BaseConfig {
  axiosInstance: AxiosLike;
}

/** Provide a fully custom adapter — complete control over HTTP */
export interface CustomAdapterConfig {
  adapter: HttpAdapter;
}

export type ClientConfig = FetchConfig | AxiosConfig | CustomAdapterConfig;

export const isFetchConfig  = (c: ClientConfig): c is FetchConfig         => 'baseUrl'       in c;
export const isAxiosConfig  = (c: ClientConfig): c is AxiosConfig          => 'axiosInstance' in c;
export const isCustomConfig = (c: ClientConfig): c is CustomAdapterConfig  => 'adapter'       in c;