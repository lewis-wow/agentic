import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class Unauthorized extends HttpException {
  static readonly status = HttpStatusCode.UNAUTHORIZED_401;
  static readonly code = 'Unauthorized';
  static readonly message = 'Authentication required.';
}
