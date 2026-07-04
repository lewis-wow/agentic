import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';

export const AuditLogEntrySchema = Schema.Struct({
  id: Schema.String,
  action: Schema.String,
  meta: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.String,
  userId: Schema.String,
  userName: Schema.String,
});

export type AuditLogEntry = Schema.Schema.Type<typeof AuditLogEntrySchema>;

export const AuditLogPageSchema = PaginatedResponseSchema(AuditLogEntrySchema);

export type AuditLogPage = Schema.Schema.Type<typeof AuditLogPageSchema>;
