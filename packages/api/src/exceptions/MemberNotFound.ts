import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class MemberNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'MemberNotFound';
  static readonly message = 'Member not found.';
}
