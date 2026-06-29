import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class Unauthorized extends Exception {
  static readonly status = HttpStatusCode.UNAUTHORIZED_401;
  static readonly code = 'Unauthorized';
  static readonly message = 'Authentication required.';
}
