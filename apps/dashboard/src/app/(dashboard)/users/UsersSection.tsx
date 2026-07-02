'use client';

import { PersonTableSkeleton } from '../../../components/PersonTableSkeleton';
import { useUsers } from '../../../queries/users';
import { UsersTable } from './UsersTable';

export const UsersSection = (): React.ReactNode => {
  const { data: users = [], isPending } = useUsers();

  if (isPending) {
    return <PersonTableSkeleton rows={4} />;
  }

  return <UsersTable users={users} />;
};
