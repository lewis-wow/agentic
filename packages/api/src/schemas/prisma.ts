import { Schema } from 'effect';

// Every response schema's exported "contract" type must equal the JSON it
// actually sends — dashboard/SDK code imports these types directly to mean
// "the shape I receive over HTTP," so date fields on those schemas stay
// `Schema.String` (see docs/specification/effect-schema.md).
//
// `IsoDateFromPrisma` is for the *other* half: the internal `*FromPrisma`
// schemas that describe a raw Prisma query result (real `Date` instances)
// and decode it straight into the wire shape. Its Type is `string` (matching
// the wire contract) and its Encoded is a `Date` (matching what Prisma
// actually returns), so route handlers never call `.toISOString()` by hand.
export const IsoDateFromPrisma = Schema.transform(
  Schema.DateFromSelf,
  Schema.String,
  {
    strict: true,
    decode: (date) => date.toISOString(),
    encode: (iso) => new Date(iso),
  },
);
