import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class InvalidFlagKey extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidFlagKey';
  static readonly message = 'key must match ^[a-z0-9-]+$.';
}
