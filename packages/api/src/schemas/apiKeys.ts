import { Schema } from 'effect';

import { IsoDateFromPrisma } from './prisma.js';

export const ApiKeyListItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  apiKeyId: Schema.String,
  environmentId: Schema.String,
  environmentName: Schema.String,
  revokedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});

export type ApiKeyListItem = Schema.Schema.Type<typeof ApiKeyListItemSchema>;

// Raw shape: matches `prisma.apiKey.findMany/create` with
// `include: { environment: { select: { id, name } } }` — Prisma nests the
// environment relation; the wire contract wants it flattened. Exported so
// `apiKeys.dto.ts` can nest it inside `CreateApiKeyResponseFromPrismaRawSchema`.
export const ApiKeyListItemFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  apiKeyId: Schema.String,
  revokedAt: Schema.NullOr(IsoDateFromPrisma),
  createdAt: IsoDateFromPrisma,
  environment: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

export const ApiKeyListItemFromPrisma = Schema.transform(
  ApiKeyListItemFromPrismaRawSchema,
  ApiKeyListItemSchema,
  {
    strict: true,
    decode: (raw) => ({
      id: raw.id,
      name: raw.name,
      apiKeyId: raw.apiKeyId,
      environmentId: raw.environment.id,
      environmentName: raw.environment.name,
      revokedAt: raw.revokedAt,
      createdAt: raw.createdAt,
    }),
    encode: (item) => ({
      id: item.id,
      name: item.name,
      apiKeyId: item.apiKeyId,
      revokedAt: item.revokedAt,
      createdAt: item.createdAt,
      environment: { id: item.environmentId, name: item.environmentName },
    }),
  },
);
