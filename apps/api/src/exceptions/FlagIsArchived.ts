import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class FlagIsArchived extends Exception {
  static readonly status = HttpStatusCode.CONFLICT_409;
  static readonly code = 'FlagIsArchived';
  static readonly message = 'Cannot toggle an archived flag.';
}
