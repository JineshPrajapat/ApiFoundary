// // Main entry point
// export { createClient } from './create-client.ts';

// // Contracts — implement these to extend ApiFoundry
// export type { HttpAdapter, RequestDescriptor, ApiResponse } from './contracts.ts';

// // Config types — use these for typing your api.ts
// export type { ClientConfig, FetchConfig, AxiosConfig, CustomAdapterConfig } from './client-config.ts';

// // BoundApi — use this to type the return of createClient()
// export type { BoundApi } from './bind-api.ts';


export { createClient } from './create-client.ts';

export type { HttpAdapter, RequestDescriptor, ApiResponse } from './contracts.ts';
export type { ClientConfig, FetchConfig, AxiosConfig, CustomAdapterConfig } from './client-config.ts';
export type { BoundApi } from './bind-api.ts';