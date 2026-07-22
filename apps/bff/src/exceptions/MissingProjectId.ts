import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class MissingProjectId extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'MissingProjectId';
  static readonly message = 'Missing project id.';
}
