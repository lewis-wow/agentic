import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export type PagedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type UsePaginatedQueryOptions<T> = {
  queryKey: unknown[];
  queryFn: (page: number) => Promise<PagedResponse<T>>;
  limit?: number;
};

type UsePaginatedQueryResult<T> = {
  data: T[] | undefined;
  page: number;
  setPage: (p: number) => void;
  isPending: boolean;
  error: Error | null;
  totalPages: number;
};

export const usePaginatedQuery = <T>(
  options: UsePaginatedQueryOptions<T>,
): UsePaginatedQueryResult<T> => {
  const [page, setPage] = useState(1);

  const queryKeyStr = JSON.stringify(options.queryKey);
  useEffect(() => {
    setPage(1);
  }, [queryKeyStr]);

  const { data, isPending, error } = useQuery({
    queryKey: [...options.queryKey, page],
    queryFn: () => options.queryFn(page),
  });

  const totalPages =
    data !== undefined && options.limit !== undefined && options.limit > 0
      ? Math.ceil(data.total / options.limit)
      : data?.total !== undefined && data.total > 0 && data.limit > 0
        ? Math.ceil(data.total / data.limit)
        : 0;

  return {
    data: data?.items,
    page,
    setPage,
    isPending,
    error: error as Error | null,
    totalPages,
  };
};
