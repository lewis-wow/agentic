import { Either, Schema } from 'effect';

import { Exception } from './Exception.js';
import type { AnyExceptionShape } from './validation/ExceptionShapeSchema.js';
import { ExceptionShapeSchema } from './validation/ExceptionShapeSchema.js';

export class HttpException<TData = undefined> extends Exception<TData> {
  static readonly status: number;

  constructor(opts?: Partial<AnyExceptionShape>) {
    super(opts);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static fromResponse(opts: {
    json: unknown;
    status: number;
  }): HttpException | null {
    const { json, status } = opts;

    const result = Schema.decodeUnknownEither(ExceptionShapeSchema)(json);

    if (Either.isLeft(result)) {
      return null;
    }

    return new HttpException({ ...result.right, status });
  }

  toResponse(): Response {
    const ctor = this.constructor as typeof HttpException;
    return Response.json(this.toJSON(), { status: ctor.status ?? 500 });
  }
}

export type AnyHttpException = HttpException<unknown>;
