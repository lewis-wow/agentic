import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class InvalidFlagStatus extends Exception {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidFlagStatus';
  static readonly message = 'status must be "active" or "inactive".';
}
