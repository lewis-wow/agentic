import { Either, Schema } from 'effect';

import { RequestValidationFailed } from '../exceptions/index.js';

// Framework-agnostic: no Hono import here. `apps/api/src/validation.ts`
// wires the Hono-specific half (`@hono/standard-validator`'s `sValidator`)
// for route middleware; this is for validating input anywhere else —
// service methods, background jobs, a future non-Hono transport — that
// still wants "decode this Effect Schema, or fail with the same
// RequestValidationFailed the HTTP layer uses."
export const decodeOrThrow =
  <A, I>(schema: Schema.Schema<A, I, never>) =>
  (input: unknown): A => {
    const result = Schema.decodeUnknownEither(schema)(input);
    if (Either.isLeft(result)) {
      throw new RequestValidationFailed();
    }
    return result.right;
  };
