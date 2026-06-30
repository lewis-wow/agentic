import { Schema } from 'effect';

export const AuditLogEntrySchema = Schema.Struct({
  id: Schema.String,
  action: Schema.String,
  meta: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.String,
  userId: Schema.String,
  userName: Schema.String,
});

export type AuditLogEntry = Schema.Schema.Type<typeof AuditLogEntrySchema>;

export const AuditLogPageSchema = Schema.Struct({
  events: Schema.Array(AuditLogEntrySchema),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});

export type AuditLogPage = Schema.Schema.Type<typeof AuditLogPageSchema>;
