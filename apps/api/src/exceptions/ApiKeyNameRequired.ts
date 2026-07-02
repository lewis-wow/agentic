import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class ApiKeyNameRequired extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'ApiKeyNameRequired';
  static readonly message = 'name and environmentId are required.';
}
