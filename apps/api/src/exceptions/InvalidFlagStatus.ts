import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class InvalidFlagStatus extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidFlagStatus';
  static readonly message = 'status must be "active" or "inactive".';
}
