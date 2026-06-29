import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class Forbidden extends Exception {
  static readonly status = HttpStatusCode.FORBIDDEN_403;
  static readonly code = 'Forbidden';
  static readonly message =
    'You do not have permission to perform this action.';
}
