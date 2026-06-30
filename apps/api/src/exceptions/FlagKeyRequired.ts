import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagKeyRequired extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'FlagKeyRequired';
  static readonly message = 'key is required.';
}
