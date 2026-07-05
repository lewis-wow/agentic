import { Schema } from 'effect';

// PaginatedResponseSchema helper — the standard { items, total, page, limit } envelope.
export const PageMetaFields = {
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
};

export const PaginatedResponseSchema = <A, I, R>(
  itemSchema: Schema.Schema<A, I, R>,
) =>
  Schema.Struct({
    items: Schema.Array(itemSchema),
    ...PageMetaFields,
  });
