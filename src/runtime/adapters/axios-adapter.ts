import type { HttpAdapter, RequestDescriptor } from '../contracts.ts';
import type { AxiosConfig } from '../client-config.ts';

export function createAxiosAdapter(config: AxiosConfig): HttpAdapter {
  return {
    async execute<T>(descriptor: RequestDescriptor<T>): Promise<T> {
      const res = await config.axiosInstance.request<T>({
        method: descriptor.method,
        url: descriptor.path,
        data: descriptor.body,
        params: descriptor.query,
        ...(config.headers !== undefined ? { headers: config.headers } : {}),
      });
      return res.data;
    },
  };
}