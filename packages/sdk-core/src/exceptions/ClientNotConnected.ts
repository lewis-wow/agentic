import { Exception } from '@repo/exception';

export class ClientNotConnected extends Exception {
  static readonly code = 'ClientNotConnected';
  static readonly message = 'Client is not connected. Call connect() first.';
}
