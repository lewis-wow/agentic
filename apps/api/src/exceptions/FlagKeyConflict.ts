import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class FlagKeyConflict extends Exception {
  static readonly status = HttpStatusCode.CONFLICT_409;
  static readonly code = 'FlagKeyConflict';
  static readonly message = 'A flag with this key already exists.';
}
