export const axiosTemplate = `
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from 'axios';

/* ============================
   Core Response Shape
============================ */

export interface ApiSuccess<T> {
  data: T;
  error: null;
  status: number;
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    status: number;
  };
  status: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;


/* ============================
   Request Options
============================ */

export interface RequestOptions {
  method: string;
  url: string;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  responseType?: AxiosRequestConfig['responseType'];
  timeout?: number;
}

/* ============================
   Client Configuration
============================ */

export interface HttpClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
  axiosConfig?: AxiosRequestConfig;
}

/* ============================
   Internal Client Holder
============================ */

let client: AxiosInstance | null = null;

/* ============================
   Client Factory
============================ */

export function createHttpClient(
  config: HttpClientConfig = {},
): AxiosInstance {
  client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 30000,
    withCredentials: config.withCredentials ?? false,
    headers: config.headers ?? {},
    ...config.axiosConfig,
  });

  return client;
}

/* ============================
   Get Client (Safe Lazy Init)
============================ */

export function getHttpClient(): AxiosInstance {
  if (!client) {
    client = createHttpClient();
  }
  return client;
}

/* ============================
   Interceptor Helpers
============================ */

export function addRequestInterceptor(
  onFulfilled: Parameters<
    AxiosInstance['interceptors']['request']['use']
  >[0],
  onRejected?: Parameters<
    AxiosInstance['interceptors']['request']['use']
  >[1],
) {
  return getHttpClient().interceptors.request.use(
    onFulfilled,
    onRejected,
  );
}

export function addResponseInterceptor(
  onFulfilled: Parameters<
    AxiosInstance['interceptors']['response']['use']
  >[0],
  onRejected?: Parameters<
    AxiosInstance['interceptors']['response']['use']
  >[1],
) {
  return getHttpClient().interceptors.response.use(
    onFulfilled,
    onRejected,
  );
}

/* ============================
   Error Normalization
============================ */

function normalizeAxiosError(error: AxiosError) {
  return {
    message: error.message,
    status: error.response?.status ?? 0,
    data: error.response?.data,
    headers: error.response?.headers,
    isNetworkError: !error.response,
    original: error,
  };
}

/* ============================
   Query Builder
============================ */

function buildQueryParams(
  query?: Record<string, any>,
): Record<string, any> | undefined {
  if (!query) return undefined;

  const cleaned: Record<string, any> = {};

  for (const key in query) {
    const value = query[key];

    if (value === undefined || value === null) continue;

    cleaned[key] = value;
  }

  return cleaned;
}

/* ============================
   Core Request Function
============================ */

export async function request<T>(
  options: RequestOptions,
): Promise<ApiResponse<T>> {
  const instance = getHttpClient();

  const {
    method,
    url,
    query,
    body,
    headers,
    signal,
    responseType,
    timeout,
  } = options;

  const config: AxiosRequestConfig = {
    method: method as any,
    url,
    params: buildQueryParams(query),
    data: body,
    headers,
    signal,
    responseType: responseType ?? 'json',
    timeout,
  };

  try {
    const response: AxiosResponse<T> =
      await instance.request<T>(config);

    if (response.status === 204) {
      return {
        data: undefined as T,
        status: response.status,
        headers: response.headers,
      };
    }

    return {
      data: response.data,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw normalizeAxiosError(error);
    }
    throw error;
  }
}
`;