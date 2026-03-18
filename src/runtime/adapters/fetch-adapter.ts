import type { HttpAdapter, RequestDescriptor } from '../contracts.ts';
import type { FetchConfig } from '../client-config.ts';

interface FetchAdapterConfig {
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number;
}

export function createFetchAdapter(config: FetchAdapterConfig): HttpAdapter {
  return {
    async execute<T>(descriptor: RequestDescriptor<T>): Promise<T> {
      const url = buildUrl(config.baseUrl, descriptor.path, descriptor.query);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeout);

      try {
         const bodyOptions: Pick<RequestInit, 'body'> =
          descriptor.body !== undefined
            ? { body: JSON.stringify(descriptor.body) }
            : {};

        const res = await fetch(url, {
          method: descriptor.method,
          headers: { 'Content-Type': 'application/json', ...config.headers },
          signal: controller.signal,
          ...bodyOptions,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as Record<string, string>;
          throw new Error(err?.message ?? `HTTP ${res.status}: ${res.statusText}`);
        }

        return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, unknown>,
): string {
  const url = new URL(baseUrl + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}