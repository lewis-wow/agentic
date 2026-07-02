'use client';

import { Button } from '@repo/ui/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type TablePaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

const PAGE_WINDOW = 5;

const getPageWindow = (page: number, totalPages: number): number[] => {
  const half = Math.floor(PAGE_WINDOW / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + PAGE_WINDOW - 1);
  start = Math.max(1, end - PAGE_WINDOW + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

export const TablePagination = ({
  page,
  totalPages,
  total,
  onPageChange,
}: TablePaginationProps): React.ReactNode => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{total} total</p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
          <span className="sr-only">Previous page</span>
        </Button>
        {getPageWindow(page, totalPages).map((p) => (
          <Button
            key={p}
            type="button"
            variant={p === page ? 'default' : 'outline'}
            size="icon-sm"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
};
