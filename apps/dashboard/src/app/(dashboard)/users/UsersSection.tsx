'use client';

import { Input } from '@repo/ui/components/ui/input';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PersonTableSkeleton } from '../../../components/PersonTableSkeleton';
import { useUsers } from '../../../queries/users';
import { UsersTable } from './UsersTable';

export const UsersSection = (): React.ReactNode => {
  const { data: users = [], isPending } = useUsers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q),
    );
  }, [users, query]);

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
        <UsersTable users={filtered} hasUsers={users.length > 0} />
      )}
    </div>
  );
};
