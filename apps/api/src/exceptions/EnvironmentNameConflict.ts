import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class EnvironmentNameConflict extends HttpException {
  static readonly status = HttpStatusCode.CONFLICT_409;
  static readonly code = 'EnvironmentNameConflict';
  static readonly message = 'An environment with this name already exists.';
}
