import { Exception } from '@repo/exception';

export class ConnectFailed extends Exception {
  static readonly code = 'ConnectFailed';
  static readonly message = 'Failed to connect to the flag stream.';
}
