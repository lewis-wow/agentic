import { HttpStatusCode } from '@repo/enums';

import { HttpException } from './HttpException.js';

/**
 * The shared fallback thrown when `HttpException.fromResponse` returns
 * `null` — the response body didn't match `ExceptionShapeSchema` (e.g. a
 * network-level error page from an intermediary proxy, not a structured API
 * error). Lives here rather than in a consuming app's `exceptions/` folder
 * since it isn't tied to any resource domain.
 */
export class UnknownError extends HttpException {
  static readonly status = HttpStatusCode.INTERNAL_SERVER_ERROR_500;
  static readonly code = 'UnknownError';
  static readonly message = 'An unknown error occurred.';
}
