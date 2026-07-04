import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class RequestValidationFailed extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'RequestValidationFailed';
  static readonly message = 'Request validation failed.';
}
