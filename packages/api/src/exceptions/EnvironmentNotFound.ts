import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class EnvironmentNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'EnvironmentNotFound';
  static readonly message = 'Environment not found.';
}
