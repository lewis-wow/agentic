import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class EnvironmentIdRequired extends Exception {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'EnvironmentIdRequired';
  static readonly message = 'environmentId is required.';
}
