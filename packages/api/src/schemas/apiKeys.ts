import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';
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

export const ApiKeyListPageSchema =
  PaginatedResponseSchema(ApiKeyListItemSchema);

export type ApiKeyListPage = Schema.Schema.Type<typeof ApiKeyListPageSchema>;

// Raw shape: matches `prisma.apiKey.findMany/create` with
// `include: { environment: { select: { id, name } } }` — Prisma nests the
// environment relation; the wire contract wants it flattened.
const ApiKeyListItemFromPrismaRawSchema = Schema.Struct({
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

export const CreateApiKeyResponseSchema = Schema.Struct({
  apiKey: ApiKeyListItemSchema,
  fullKey: Schema.String,
});

export type CreateApiKeyResponse = Schema.Schema.Type<
  typeof CreateApiKeyResponseSchema
>;

const CreateApiKeyResponseFromPrismaRawSchema = Schema.Struct({
  apiKey: ApiKeyListItemFromPrismaRawSchema,
  fullKey: Schema.String,
});

export const CreateApiKeyResponseFromPrisma = Schema.transform(
  CreateApiKeyResponseFromPrismaRawSchema,
  CreateApiKeyResponseSchema,
  {
    strict: true,
    decode: (raw) => ({
      apiKey: {
        id: raw.apiKey.id,
        name: raw.apiKey.name,
        apiKeyId: raw.apiKey.apiKeyId,
        environmentId: raw.apiKey.environment.id,
        environmentName: raw.apiKey.environment.name,
        revokedAt: raw.apiKey.revokedAt,
        createdAt: raw.apiKey.createdAt,
      },
      fullKey: raw.fullKey,
    }),
    encode: (response) => ({
      apiKey: {
        id: response.apiKey.id,
        name: response.apiKey.name,
        apiKeyId: response.apiKey.apiKeyId,
        revokedAt: response.apiKey.revokedAt,
        createdAt: response.apiKey.createdAt,
        environment: {
          id: response.apiKey.environmentId,
          name: response.apiKey.environmentName,
        },
      },
      fullKey: response.fullKey,
    }),
  },
);

export const RotateApiKeyResponseSchema = Schema.Struct({
  fullKey: Schema.String,
});

export type RotateApiKeyResponse = Schema.Schema.Type<
  typeof RotateApiKeyResponseSchema
>;

export const RevokeApiKeyResponseSchema = Schema.Struct({
  apiKey: Schema.Struct({
    id: Schema.String,
    revokedAt: Schema.NullOr(Schema.String),
  }),
});

export type RevokeApiKeyResponse = Schema.Schema.Type<
  typeof RevokeApiKeyResponseSchema
>;

const RevokeApiKeyResponseFromPrismaRawSchema = Schema.Struct({
  apiKey: Schema.Struct({
    id: Schema.String,
    revokedAt: Schema.NullOr(IsoDateFromPrisma),
  }),
});

export const RevokeApiKeyResponseFromPrisma = Schema.transform(
  RevokeApiKeyResponseFromPrismaRawSchema,
  RevokeApiKeyResponseSchema,
  { strict: true, decode: (raw) => raw, encode: (response) => response },
);

// --- Route input schemas (path params / query string) ---

export const ApiKeyListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});

export const ApiKeyIdParamSchema = Schema.Struct({
  apiKeyId: Schema.String.pipe(Schema.minLength(1)),
});
