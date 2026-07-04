import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagIsArchived extends HttpException {
  static readonly status = HttpStatusCode.CONFLICT_409;
  static readonly code = 'FlagIsArchived';
  static readonly message = 'Cannot toggle an archived flag.';
}
