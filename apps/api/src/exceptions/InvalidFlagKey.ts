import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class InvalidFlagKey extends Exception {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidFlagKey';
  static readonly message = 'key must match ^[a-z0-9-]+$.';
}
