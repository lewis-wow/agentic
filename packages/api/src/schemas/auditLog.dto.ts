import { Schema } from 'effect';

import { AuditLogEntrySchema } from './auditLog.js';
import { PaginatedResponseSchema } from './pagination.js';

export const AuditLogPageSchema = PaginatedResponseSchema(AuditLogEntrySchema);

export type AuditLogPage = Schema.Schema.Type<typeof AuditLogPageSchema>;
