// Generates the OpenAPI document from the schemas below — see docs/specification/openapi.md.
import { JSONSchema, Schema } from 'effect';

import { ApiKeyListPageSchema } from './schemas/apiKeys.dto.js';
import { AuditLogPageSchema } from './schemas/auditLog.dto.js';
import { EnvironmentListPageSchema } from './schemas/environments.dto.js';
import {
  FlagListPageSchema,
  FlagSnapshotResponseSchema,
} from './schemas/flags.dto.js';
import {
  CreateApiKeyRequestSchema,
  CreateEnvironmentRequestSchema,
  CreateProjectRequestSchema,
  RenameProjectRequestSchema,
} from './schemas/projects.dto.js';

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

type RequestBody = {
  schema: Schema.Schema.Any;
};

type ResponseBody = {
  schema?: Schema.Schema.Any;
  status?: number;
  description?: string;
};

type OpenApiRouteDefinition = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  request?: RequestBody;
  response?: ResponseBody;
};

// Only endpoints already backed by a Schema.Struct in this package are
// listed here — the document is generated from those schemas, not hand
// duplicated. Endpoints that still parse request bodies by hand or return
// ad hoc JSON shapes are intentionally absent until they adopt a schema.
const ROUTES: readonly OpenApiRouteDefinition[] = [
  {
    method: 'post',
    path: '/projects',
    tag: 'Projects',
    summary: 'Create a project',
    request: { schema: CreateProjectRequestSchema },
    response: { status: 201, description: 'Created' },
  },
  {
    method: 'patch',
    path: '/projects/{projectId}',
    tag: 'Projects',
    summary: 'Rename a project',
    request: { schema: RenameProjectRequestSchema },
  },
  {
    method: 'get',
    path: '/projects/{projectId}/flags',
    tag: 'Flags',
    summary: 'List flags for an environment',
    response: { schema: FlagListPageSchema },
  },
  {
    method: 'get',
    path: '/projects/{projectId}/flags/{flagId}/audit-log',
    tag: 'Flags',
    summary: 'List audit log entries for a flag',
    response: { schema: AuditLogPageSchema },
  },
  {
    method: 'get',
    path: '/projects/{projectId}/environments',
    tag: 'Environments',
    summary: 'List environments for a project',
    response: { schema: EnvironmentListPageSchema },
  },
  {
    method: 'post',
    path: '/projects/{projectId}/environments',
    tag: 'Environments',
    summary: 'Create an environment',
    request: { schema: CreateEnvironmentRequestSchema },
    response: { status: 201, description: 'Created' },
  },
  {
    method: 'get',
    path: '/projects/{projectId}/api-keys',
    tag: 'API Keys',
    summary: 'List API keys for a project',
    response: { schema: ApiKeyListPageSchema },
  },
  {
    method: 'post',
    path: '/projects/{projectId}/api-keys',
    tag: 'API Keys',
    summary: 'Create an API key',
    request: { schema: CreateApiKeyRequestSchema },
    response: { status: 201, description: 'Created' },
  },
  {
    method: 'get',
    path: '/v1/flags',
    tag: 'SDK',
    summary: 'Fetch the flag snapshot for an environment (SDK)',
    response: { schema: FlagSnapshotResponseSchema },
  },
];

const PATH_PARAM_PATTERN = /\{([^}]+)\}/g;

type OpenApiParameter = {
  name: string;
  in: 'path';
  required: true;
  schema: { type: 'string' };
};

const pathParameters = (path: string): OpenApiParameter[] =>
  Array.from(path.matchAll(PATH_PARAM_PATTERN)).map(([, name]) => ({
    name: name as string,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));

const toJsonSchema = (schema: Schema.Schema.Any): Record<string, unknown> => {
  const { $schema: _$schema, ...jsonSchema } = JSONSchema.make(schema);
  return jsonSchema;
};

const jsonContent = (schema: Schema.Schema.Any) => ({
  'application/json': { schema: toJsonSchema(schema) },
});

export type OpenApiDocument = Record<string, unknown>;

// Only called by apps/api/src/scripts/generate-openapi.ts — never imported
// by the running server, so this module's `effect` (Schema/JSONSchema) cost
// never ships in the runtime bundle. See docs/specification/openapi.md.

export const generateOpenApiDocument = (): OpenApiDocument => {
  const paths: Record<string, Record<string, unknown>> = {};
  const tags = new Set<string>();

  for (const route of ROUTES) {
    tags.add(route.tag);
    const pathItem = (paths[route.path] ??= {});
    const status = String(route.response?.status ?? 200);

    pathItem[route.method] = {
      tags: [route.tag],
      summary: route.summary,
      security: [{ bearerAuth: [] }],
      ...(pathParameters(route.path).length > 0
        ? { parameters: pathParameters(route.path) }
        : {}),
      ...(route.request
        ? {
            requestBody: {
              required: true,
              content: jsonContent(route.request.schema),
            },
          }
        : {}),
      responses: {
        [status]: {
          description: route.response?.description ?? 'OK',
          ...(route.response?.schema
            ? { content: jsonContent(route.response.schema) }
            : {}),
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Feature Flag Service API',
      version: '1.0.0',
      description:
        'Generated directly from the Effect Schemas in @repo/api — see packages/api/src/openapi.ts.',
    },
    servers: [{ url: '/' }],
    tags: Array.from(tags, (name) => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  };
};
