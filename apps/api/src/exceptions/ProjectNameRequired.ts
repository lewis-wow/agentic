import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class ProjectNameRequired extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'ProjectNameRequired';
  static readonly message = 'name is required.';
}
