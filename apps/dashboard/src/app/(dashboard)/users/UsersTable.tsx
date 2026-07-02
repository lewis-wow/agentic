'use client';

import { DataTable } from '@repo/ui/components/data-table';
import { Badge } from '@repo/ui/components/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-gray-500">{row.original.email}</span>
      </div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
  },
];

type Props = {
  users: UserRow[];
};

export const UsersTable = ({ users }: Props): React.ReactNode => (
  <DataTable columns={columns} data={users} emptyMessage="No users yet." />
);
