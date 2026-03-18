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

export const isFetchConfig  = (c: ClientConfig): c is FetchConfig        => 'baseUrl'       in c;
export const isAxiosConfig  = (c: ClientConfig): c is AxiosConfig         => 'axiosInstance' in c;
export const isCustomConfig = (c: ClientConfig): c is CustomAdapterConfig => 'adapter'       in c;