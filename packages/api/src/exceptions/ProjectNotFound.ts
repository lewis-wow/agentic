import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class ProjectNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'ProjectNotFound';
  static readonly message = 'Project not found.';
}
