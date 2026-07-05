import { Schema } from 'effect';

import {
  ApiKeyListItemFromPrismaRawSchema,
  ApiKeyListItemSchema,
} from './apiKeys.js';
import { PaginatedResponseSchema } from './pagination.js';
import { IsoDateFromPrisma } from './prisma.js';

// API key request/response schemas, route param/query schemas.
export const ApiKeyListPageSchema =
  PaginatedResponseSchema(ApiKeyListItemSchema);

export type ApiKeyListPage = Schema.Schema.Type<typeof ApiKeyListPageSchema>;

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

export const ApiKeyListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});

export const ApiKeyIdParamSchema = Schema.Struct({
  apiKeyId: Schema.String.pipe(Schema.minLength(1)),
});
