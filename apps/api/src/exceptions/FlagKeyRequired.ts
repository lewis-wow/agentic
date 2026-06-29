import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class FlagKeyRequired extends Exception {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'FlagKeyRequired';
  static readonly message = 'key is required.';
}
