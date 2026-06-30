import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagNameRequired extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'FlagNameRequired';
  static readonly message = 'name is required.';
}
