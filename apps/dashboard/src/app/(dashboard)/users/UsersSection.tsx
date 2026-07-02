'use client';

import { TablePagination } from '@repo/ui/components/TablePagination';
import { Input } from '@repo/ui/components/ui/input';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PersonTableSkeleton } from '../../../components/PersonTableSkeleton';
import { useUsers } from '../../../queries/users';
import { UsersTable } from './UsersTable';

export const UsersSection = (): React.ReactNode => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const {
    data: users,
    isPending,
    page,
    setPage,
    totalPages,
    total,
  } = useUsers(debouncedQuery);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-sm">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      {isPending ? (
        <PersonTableSkeleton rows={4} />
      ) : (
        <>
          <UsersTable
            users={users ?? []}
            hasQuery={debouncedQuery.length > 0}
          />
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};
