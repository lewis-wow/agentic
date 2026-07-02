import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class CannotAddOwnerAsMember extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'CannotAddOwnerAsMember';
  static readonly message = 'The owner already has implicit access.';
}
