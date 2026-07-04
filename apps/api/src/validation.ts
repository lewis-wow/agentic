import { sValidator } from '@hono/standard-validator';
import { RequestValidationFailed } from '@repo/api/exceptions';
import type { Schema } from 'effect';
import { Schema as S } from 'effect';
import type { ValidationTargets } from 'hono';

// Every Hono route that reads a JSON body, query string, or path params
// validates it through an Effect Schema via this helper — never by hand
// (typeof checks, manual destructuring, ad hoc JSON.parse). See
// docs/specification/effect-schema.md.
export const validate = <Target extends keyof ValidationTargets, A, I>(
  target: Target,
  schema: Schema.Schema<A, I, never>,
) =>
  sValidator(target, S.standardSchemaV1(schema), (result) => {
    if (!result.success) {
      return new RequestValidationFailed().toResponse();
    }
  });
