'use client';

import { DataTable } from '@repo/ui/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

type ProjectRow = {
  id: string;
  name: string;
  createdAt: Date;
};

const columns: ColumnDef<ProjectRow>[] = [
  {
    accessorKey: 'name',
    header: 'Project',
    cell: ({ row }) => (
      <Link
        href={`/projects/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-xs text-gray-500">
        {new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(row.original.createdAt)}
      </span>
    ),
  },
];

type Props = {
  projects: ProjectRow[];
  emptyMessage: string;
};

export const ProjectsTable = ({
  projects,
  emptyMessage,
}: Props): React.ReactNode => (
  <DataTable columns={columns} data={projects} emptyMessage={emptyMessage} />
);
