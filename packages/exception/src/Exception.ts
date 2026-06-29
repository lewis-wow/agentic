import { omitUndefined } from '@repo/utils';
import { Either, Schema } from 'effect';

import type { AnyExceptionShape } from './validation/ExceptionShapeSchema.js';
import { ExceptionShapeSchema } from './validation/ExceptionShapeSchema.js';

export class Exception<TData = undefined>
  extends Error
  implements AnyExceptionShape
{
  static readonly message: string = 'An unexpected error occurred.';
  static readonly status?: number;
  static readonly code: string;

  public readonly status?: number;
  public readonly code: string;
  public readonly data: TData;

  constructor(opts?: Partial<AnyExceptionShape>) {
    const ctor = new.target as typeof Exception;

    const status = opts?.status ?? ctor.status;
    const message = opts?.message ?? ctor.message;
    const code = opts?.code ?? ctor.code;
    const cause = opts?.cause;
    const data = opts?.data as TData;

    super(message, { cause });
    Object.setPrototypeOf(this, new.target.prototype);

    this.code = code;
    this.status = status;
    this.data = data;
  }

  static fromResponse(opts: {
    json: unknown;
    status: number;
  }): Exception | null {
    const { json, status } = opts;

    const result = Schema.decodeUnknownEither(ExceptionShapeSchema)(json);

    if (Either.isLeft(result)) {
      return null;
    }

    return new Exception({ ...result.right, status });
  }

  toJSON(opts?: { omitData?: boolean }): Record<string, unknown> {
    return omitUndefined({
      message: this.message,
      code: this.code,
      data: opts?.omitData === true ? undefined : (this.data as unknown),
    });
  }

  toResponse(): Response {
    return Response.json(this.toJSON(), { status: this.status ?? 500 });
  }
}

export type AnyException = Exception<unknown>;
