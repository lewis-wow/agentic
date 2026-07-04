import { SdkClient } from './SdkClient.js';
import type { SdkClientOptions } from './SdkClient.js';

export * from './SdkClient.js';
export * from './exceptions/ClientNotConnected.js';
export * from './exceptions/ConnectFailed.js';

export type CreateClientArgs = SdkClientOptions;

export const createClient = (args: CreateClientArgs): SdkClient =>
  new SdkClient(args);
