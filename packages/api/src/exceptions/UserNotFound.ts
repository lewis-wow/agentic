import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class UserNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'UserNotFound';
  static readonly message = 'User not found.';
}
