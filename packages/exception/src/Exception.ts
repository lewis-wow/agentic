import { omitUndefined } from '@repo/utils';

import type { AnyExceptionShape } from './validation/ExceptionShapeSchema.js';

export class Exception<TData = undefined>
  extends Error
  implements Pick<AnyExceptionShape, 'code' | 'data'>
{
  static readonly message: string = 'An unexpected error occurred.';
  static readonly code: string;

  public readonly code: string;
  public readonly data: TData;

  constructor(opts?: Partial<AnyExceptionShape>) {
    const ctor = new.target as typeof Exception;

    const message = opts?.message ?? ctor.message;
    const code = opts?.code ?? ctor.code;
    const cause = opts?.cause;
    const data = opts?.data as TData;

    super(message, { cause });
    Object.setPrototypeOf(this, new.target.prototype);

    this.code = code;
    this.data = data;
  }

  toJSON(opts?: { omitData?: boolean }): Record<string, unknown> {
    return omitUndefined({
      message: this.message,
      code: this.code,
      data: opts?.omitData === true ? undefined : (this.data as unknown),
    });
  }
}

export type AnyException = Exception<unknown>;
