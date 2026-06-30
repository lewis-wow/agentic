type ParsePaginationDefaultsOptions = {
  limit?: number;
};

type ParsePaginationParamsResult = {
  page: number;
  limit: number;
};

export const parsePaginationParams = (
  query: Record<string, string>,
  defaults?: ParsePaginationDefaultsOptions,
): ParsePaginationParamsResult => {
  const defaultLimit = defaults?.limit ?? 10;

  const rawPage = parseInt(query['page'] ?? '1', 10);
  const rawLimit = parseInt(query['limit'] ?? String(defaultLimit), 10);

  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(
    100,
    Math.max(1, isNaN(rawLimit) ? defaultLimit : rawLimit),
  );

  return { page, limit };
};

type BuildPrismaPageResult = {
  skip: number;
  take: number;
};

export const buildPrismaPage = (
  page: number,
  limit: number,
): BuildPrismaPageResult => ({
  skip: (page - 1) * limit,
  take: limit,
});

type BuildPageMetaResult = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const buildPageMeta = (
  total: number,
  page: number,
  limit: number,
): BuildPageMetaResult => ({
  total,
  page,
  limit,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});
