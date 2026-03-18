import type { HttpAdapter } from './contracts.ts';
import type { ClientConfig } from './client-config.ts';
import { isFetchConfig, isAxiosConfig, isCustomConfig } from './client-config.ts';
import { createFetchAdapter } from './adapters/fetch-adapter.ts';
import { createAxiosAdapter } from './adapters/axios-adapter.ts';

/**
 * Resolves ClientConfig → HttpAdapter.
 * The only place in the codebase that knows which adapter to instantiate.
 *
 * Resolution priority:
 *   1. CustomAdapterConfig  — user-provided, we step aside entirely
 *   2. AxiosConfig          — wrap the user's Axios instance
 *   3. FetchConfig          — built-in fetch (default)
 */
export function resolveAdapter(config: ClientConfig): HttpAdapter {
  if (isCustomConfig(config)) return config.adapter;

  if (isAxiosConfig(config)) return createAxiosAdapter(config);

  if (isFetchConfig(config)) {
    return createFetchAdapter({
      baseUrl:  config.baseUrl,
      headers:  config.headers ?? {},
      timeout:  config.timeout ?? 30_000,
    });
  }

  throw new Error(
    '[ApiFoundry] Invalid ClientConfig — must include baseUrl, axiosInstance, or adapter.',
  );
}