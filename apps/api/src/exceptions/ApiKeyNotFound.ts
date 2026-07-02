import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class ApiKeyNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'ApiKeyNotFound';
  static readonly message = 'API key not found.';
}
