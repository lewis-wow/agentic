'use client';

import { useUsers } from '../../../queries/users';
import { UsersTable } from './UsersTable';

export const UsersSection = (): React.ReactNode => {
  const { data: users = [], isPending } = useUsers();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return <UsersTable users={users} />;
};
