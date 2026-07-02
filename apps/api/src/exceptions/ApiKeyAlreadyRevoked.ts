import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class ApiKeyAlreadyRevoked extends HttpException {
  static readonly status = HttpStatusCode.CONFLICT_409;
  static readonly code = 'ApiKeyAlreadyRevoked';
  static readonly message = 'This API key has already been revoked.';
}
