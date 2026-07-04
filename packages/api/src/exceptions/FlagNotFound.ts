import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'FlagNotFound';
  static readonly message = 'Flag not found.';
}
