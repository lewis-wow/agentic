import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class EnvironmentNameRequired extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'EnvironmentNameRequired';
  static readonly message = 'name is required.';
}
