import { Schema } from 'effect';

export const ExceptionShapeSchema = Schema.Struct({
  message: Schema.String,
  code: Schema.String,
  data: Schema.optionalWith(Schema.Unknown, { exact: true }),
});

export type AnyExceptionShape = {
  message?: string;
  code: string;
  status?: number;
  data?: unknown;
  cause?: unknown;
};
