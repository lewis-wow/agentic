import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';
import { IsoDateFromPrisma } from './prisma.js';

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

// Raw shape: matches `prisma.auditEvent.findMany` with
// `include: { user: { select: { id, name } } }` — Prisma nests the user
// relation; the wire contract wants it flattened onto the entry.
const AuditLogEntryFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  action: Schema.String,
  meta: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: IsoDateFromPrisma,
  user: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

export const AuditLogEntryFromPrisma = Schema.transform(
  AuditLogEntryFromPrismaRawSchema,
  AuditLogEntrySchema,
  {
    strict: true,
    decode: (raw) => ({
      id: raw.id,
      action: raw.action,
      meta: raw.meta,
      createdAt: raw.createdAt,
      userId: raw.user.id,
      userName: raw.user.name,
    }),
    encode: (entry) => ({
      id: entry.id,
      action: entry.action,
      meta: entry.meta,
      createdAt: entry.createdAt,
      user: { id: entry.userId, name: entry.userName },
    }),
  },
);
