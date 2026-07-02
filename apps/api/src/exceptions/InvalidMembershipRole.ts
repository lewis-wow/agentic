import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class InvalidMembershipRole extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidMembershipRole';
  static readonly message = 'role must be "admin" or "viewer".';
}
