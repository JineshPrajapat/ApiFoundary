export const fetchTemplate = `
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

let config = {
  baseUrl: '',
  timeout: 30000,
};

export function setConfig(newConfig: Partial<typeof config>) {
  config = { ...config, ...newConfig };
}

export async function request<T>({
  method,
  url,
  body,
  query,
}: {
  method: string;
  url: string;
  body?: any;
  query?: Record<string, any>;
}): Promise<ApiResponse<T>> {
  const queryString = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query).filter(
          ([_, v]) => v !== undefined,
        ) as any,
      ).toString()
    : '';

  try {
    const res = await fetch(
      config.baseUrl + url + queryString,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        data: null,
        error: {
          message: data?.message || 'Request failed',
          status: res.status,
        },
        status: res.status,
      };
    }

    return {
      data,
      error: null,
      status: res.status,
    };
  } catch (err: any) {
    return {
      data: null,
      error: {
        message: err.message,
        status: 0,
      },
      status: 0,
    };
  }
}
`;