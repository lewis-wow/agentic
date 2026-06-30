import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class InvalidFlagType extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidFlagType';
  static readonly message = 'Invalid flag type.';
}
