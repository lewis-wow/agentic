'use client';

import { FlagTable, type FlagTableRow } from '@repo/ui/components/FlagTable';
import { useMemo, useState } from 'react';

import {
  useArchiveFlag,
  useEnvironments,
  useFlags,
  useToggleFlag,
  useUnarchiveFlag,
  type FlagListItem,
  type FlagStatus,
} from '../../../../../queries/flags';
import { CreateFlagDialog } from './CreateFlagDialog';
import { DeleteFlagDialog } from './DeleteFlagDialog';
import { EditFlagDialog } from './EditFlagDialog';
import { FlagHistoryDialog } from './FlagHistoryDialog';

type Props = {
  projectId: string;
  canManage: boolean;
  environmentId: string | null;
};

const STATUS_FILTERS: { value: FlagStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const formatRollout = (flag: FlagListItem): string => {
  if (flag.type === 'percentage_rollout') return `${flag.rollout}%`;
  if (flag.type === 'targeted') return 'Targeted';
  return '—';
};

export const FlagsClient = ({
  projectId,
  canManage,
  environmentId,
}: Props): React.ReactNode => {
  const { data: environments, isPending: envsLoading } =
    useEnvironments(projectId);

  const currentEnvId =
    environmentId ??
    (environments && environments[0] ? environments[0].id : null);

  const { data: flags, isPending: flagsLoading } = useFlags(
    projectId,
    currentEnvId,
  );

  const toggleMutation = useToggleFlag(projectId);
  const archiveMutation = useArchiveFlag(projectId);
  const unarchiveMutation = useUnarchiveFlag(projectId);

  const [statusFilter, setStatusFilter] = useState<FlagStatus | 'all'>('all');

  const [editingFlag, setEditingFlag] = useState<FlagTableRow | null>(null);
  const [historyFlag, setHistoryFlag] = useState<FlagTableRow | null>(null);
  const [deletingFlag, setDeletingFlag] = useState<FlagTableRow | null>(null);

  const statusFilteredFlags = useMemo(() => {
    if (!flags) return [];
    if (statusFilter === 'all') return flags;
    return flags.filter((flag) => flag.status === statusFilter);
  }, [flags, statusFilter]);

  const rows: FlagTableRow[] = statusFilteredFlags.map((flag) => ({
    id: flag.id,
    name: flag.name,
    key: flag.key,
    status: flag.status,
    rollout: formatRollout(flag),
  }));

  const handleToggle = (row: FlagTableRow): void => {
    if (!currentEnvId) return;
    const next = row.status === 'active' ? 'inactive' : 'active';
    toggleMutation.mutate({
      flagId: row.id,
      environmentId: currentEnvId,
      status: next,
    });
  };

  const handleArchiveToggle = (row: FlagTableRow): void => {
    if (row.status === 'archived') {
      unarchiveMutation.mutate(row.id);
    } else {
      archiveMutation.mutate(row.id);
    }
  };

  if (envsLoading) {
    return <p className="text-sm text-gray-500">Loading environments…</p>;
  }

  if (!environments || environments.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No environments found. Create one on the project page first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {flagsLoading ? (
        <p className="text-sm text-gray-500">Loading flags…</p>
      ) : (
        <FlagTable
          flags={rows}
          canManage={canManage}
          onToggle={handleToggle}
          onEdit={setEditingFlag}
          onViewHistory={setHistoryFlag}
          onArchiveToggle={handleArchiveToggle}
          onDelete={setDeletingFlag}
          isToggling={(row) =>
            toggleMutation.isPending &&
            toggleMutation.variables?.flagId === row.id
          }
          filters={
            <StatusSelector value={statusFilter} onChange={setStatusFilter} />
          }
          actions={
            canManage && currentEnvId ? (
              <CreateFlagDialog projectId={projectId} />
            ) : null
          }
        />
      )}

      {editingFlag && (
        <EditFlagDialog
          projectId={projectId}
          flagId={editingFlag.id}
          canManage={canManage}
          open={!!editingFlag}
          onOpenChange={(open) => !open && setEditingFlag(null)}
        />
      )}
      {historyFlag && (
        <FlagHistoryDialog
          projectId={projectId}
          flagId={historyFlag.id}
          flagName={historyFlag.name}
          open={!!historyFlag}
          onOpenChange={(open) => !open && setHistoryFlag(null)}
        />
      )}
      {deletingFlag && (
        <DeleteFlagDialog
          projectId={projectId}
          flagId={deletingFlag.id}
          flagName={deletingFlag.name}
          open={!!deletingFlag}
          onOpenChange={(open) => !open && setDeletingFlag(null)}
        />
      )}
    </div>
  );
};

type StatusSelectorProps = {
  value: FlagStatus | 'all';
  onChange: (value: FlagStatus | 'all') => void;
};

const StatusSelector = ({
  value,
  onChange,
}: StatusSelectorProps): React.ReactNode => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as FlagStatus | 'all')}
    aria-label="Filter by status"
    className="rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black"
  >
    {STATUS_FILTERS.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
