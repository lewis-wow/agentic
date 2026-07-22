import { SdkClient } from './SdkClient.js';
import type { SdkClientOptions } from './SdkClient.js';

export * from './SdkClient.js';
export * from './exceptions/ClientNotConnected.js';
export * from './exceptions/ConnectFailed.js';

export type CreateClientArgs<TDeps = undefined> = SdkClientOptions<TDeps>;

export const createClient = <TDeps = undefined>(
  args: CreateClientArgs<TDeps>,
): SdkClient<TDeps> => new SdkClient<TDeps>(args);
