'use client';

import { DataTable } from '@repo/ui/components/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import type { ColumnDef } from '@tanstack/react-table';

import { useAuditLog, type AuditLogEntry } from '../../../../../queries/flags';

const ACTION_LABELS: Record<string, string> = {
  'flag.created': 'Created',
  'flag.renamed': 'Renamed',
  'flag.archived': 'Archived',
  'flag.unarchived': 'Unarchived',
  'flag.deleted': 'Deleted',
  'flag.toggled': 'Toggled',
  'flag.rollout_updated': 'Rollout updated',
  'flag.rules_updated': 'Rules updated',
};

const formatMeta = (action: string, meta: Record<string, unknown>): string => {
  if (action === 'flag.created') {
    return `"${String(meta['key'])}"`;
  }
  if (action === 'flag.renamed') {
    return `"${String(meta['oldName'])}" → "${String(meta['newName'])}"`;
  }
  if (action === 'flag.toggled') {
    const envName = meta['environmentName'] ?? meta['environmentId'];
    return `${String(envName)}: ${String(meta['status'])}`;
  }
  if (action === 'flag.rollout_updated') {
    const envName = meta['environmentName'] ?? meta['environmentId'];
    return `${String(envName)}: ${String(meta['type'])} ${String(meta['rollout'])}%`;
  }
  if (action === 'flag.rules_updated') {
    const envName = meta['environmentName'] ?? meta['environmentId'];
    return `${String(envName)}: rules updated`;
  }
  return '';
};

const formatAbsoluteDate = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const AUDIT_COLUMNS: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <span className="font-medium">
        {ACTION_LABELS[row.original.action] ?? row.original.action}
      </span>
    ),
  },
  {
    id: 'detail',
    header: 'Detail',
    cell: ({ row }) => (
      <span className="text-gray-500">
        {formatMeta(row.original.action, row.original.meta)}
      </span>
    ),
  },
  {
    accessorKey: 'userName',
    header: 'User',
    cell: ({ row }) => (
      <span className="text-gray-500">{row.original.userName}</span>
    ),
  },
  {
    id: 'when',
    header: 'When',
    cell: ({ row }) => (
      <time
        title={formatRelativeTime(row.original.createdAt)}
        className="text-xs text-gray-400"
      >
        {formatAbsoluteDate(row.original.createdAt)}
      </time>
    ),
  },
];

type Props = {
  projectId: string;
  flagId: string;
  flagName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const FlagHistoryDialog = ({
  projectId,
  flagId,
  flagName,
  open,
  onOpenChange,
}: Props): React.ReactNode => {
  const {
    data: entries,
    isPending,
    error,
    page,
    setPage,
    totalPages,
  } = useAuditLog(projectId, flagId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>History — {flagName}</DialogTitle>
          <DialogDescription>
            Recent changes made to this flag.
          </DialogDescription>
        </DialogHeader>

        {isPending && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-700">{error.message}</p>}

        {!isPending && !error && (
          <>
            <DataTable
              columns={AUDIT_COLUMNS}
              data={entries ?? []}
              emptyMessage="No events yet."
            />

            {totalPages > 1 && (
              <div className="flex items-center gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={[
                        'rounded border px-2 py-1 text-xs',
                        p === page ? 'bg-black text-white' : 'hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
