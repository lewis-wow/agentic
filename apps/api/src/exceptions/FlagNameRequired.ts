import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class FlagNameRequired extends Exception {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'FlagNameRequired';
  static readonly message = 'name is required.';
}
