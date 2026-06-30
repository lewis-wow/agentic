import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class InvalidRollout extends HttpException {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'InvalidRollout';
  static readonly message = 'Rollout must be an integer between 0 and 100.';
}
