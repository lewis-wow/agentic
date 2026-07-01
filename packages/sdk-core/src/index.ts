import { SdkClient } from './SdkClient.js';
import type { SdkClientOptions } from './SdkClient.js';

export { SdkClient } from './SdkClient.js';
export type { SdkClientOptions, FlagChangeDetail } from './SdkClient.js';
export { ClientNotConnected } from './exceptions/ClientNotConnected.js';
export { ConnectFailed } from './exceptions/ConnectFailed.js';

export type CreateClientArgs = SdkClientOptions;

export const createClient = (args: CreateClientArgs): SdkClient =>
  new SdkClient(args);
