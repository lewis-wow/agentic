'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useArchiveFlag,
  useAuditLog,
  useDeleteFlag,
  useFlagDetail,
  useRenameFlag,
  useToggleFlag,
  useUnarchiveFlag,
  useUpdateFlagEnvironment,
  useUpdateFlagRules,
  type FlagDetail,
  type FlagState,
  type FlagType,
  type TargetingRule,
} from '../../../../../../queries/flags.js';

type Props = {
  projectId: string;
  flagId: string;
  canManage: boolean;
};

export const FlagDetailClient = ({
  projectId,
  flagId,
  canManage,
}: Props): React.ReactNode => {
  const { data: flag, isPending, error } = useFlagDetail(projectId, flagId);

  if (isPending) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-700">{error.message}</p>;
  if (!flag) return null;

  const isArchived = flag.states.every((s) => s.status === 'archived');

  return (
    <div className="space-y-8">
      <HeaderSection flag={flag} isArchived={isArchived} />

      {canManage && (
        <RenameSection
          projectId={projectId}
          flagId={flagId}
          currentName={flag.name}
        />
      )}

      <StatesSection
        projectId={projectId}
        flagId={flagId}
        states={flag.states}
        canManage={canManage}
        isArchived={isArchived}
      />

      {canManage &&
        flag.states
          .filter((s) => s.type === 'targeted' && s.status !== 'archived')
          .map((s) => (
            <RuleBuilderSection
              key={s.environmentId}
              projectId={projectId}
              flagId={flagId}
              state={s}
            />
          ))}

      <AuditLogSection projectId={projectId} flagId={flagId} />

      {canManage && (
        <DangerSection
          projectId={projectId}
          flagId={flagId}
          flagName={flag.name}
          isArchived={isArchived}
        />
      )}
    </div>
  );
};

type HeaderSectionProps = { flag: FlagDetail; isArchived: boolean };
const HeaderSection = ({
  flag,
  isArchived,
}: HeaderSectionProps): React.ReactNode => (
  <div className="space-y-1">
    <div className="flex items-center gap-3">
      <h1 className="text-xl font-semibold">{flag.name}</h1>
      {isArchived && (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
          archived
        </span>
      )}
    </div>
    <p className="font-mono text-sm text-gray-400">{flag.key}</p>
  </div>
);

type RenameSectionProps = {
  projectId: string;
  flagId: string;
  currentName: string;
};
const RenameSection = ({
  projectId,
  flagId,
  currentName,
}: RenameSectionProps): React.ReactNode => {
  const [name, setName] = useState(currentName);
  const mutation = useRenameFlag(projectId, flagId);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!name || name === currentName) return;
    mutation.mutate({ name });
  };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Rename
      </h2>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          disabled={mutation.isPending || name === currentName}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {mutation.isError && (
        <p className="text-sm text-red-700">{mutation.error.message}</p>
      )}
    </section>
  );
};

type StatesSectionProps = {
  projectId: string;
  flagId: string;
  states: FlagState[];
  canManage: boolean;
  isArchived: boolean;
};
const StatesSection = ({
  projectId,
  flagId,
  states,
  canManage,
  isArchived,
}: StatesSectionProps): React.ReactNode => {
  const toggleMutation = useToggleFlag(projectId);
  const updateMutation = useUpdateFlagEnvironment(projectId);

  const handleToggle = (state: FlagState): void => {
    const next = state.status === 'active' ? 'inactive' : 'active';
    toggleMutation.mutate({
      flagId,
      environmentId: state.environmentId,
      status: next,
    });
  };

  const handleTypeChange = (state: FlagState, newType: FlagType): void => {
    updateMutation.mutate({
      flagId,
      environmentId: state.environmentId,
      type: newType,
    });
  };

  const handleRolloutBlur = (state: FlagState, value: number): void => {
    if (value === state.rollout) return;
    updateMutation.mutate({
      flagId,
      environmentId: state.environmentId,
      rollout: value,
    });
  };

  const isUpdating = (environmentId: string): boolean =>
    (updateMutation.isPending &&
      updateMutation.variables?.environmentId === environmentId) ||
    (toggleMutation.isPending &&
      toggleMutation.variables?.environmentId === environmentId);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Environments
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            <th className="pb-2 pr-4">Environment</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Toggle</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2">Rollout %</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {states.map((state) => {
            const busy = isUpdating(state.environmentId);
            return (
              <EnvironmentRow
                key={state.id}
                state={state}
                canManage={canManage}
                isArchived={isArchived}
                isBusy={busy}
                onToggle={handleToggle}
                onTypeChange={handleTypeChange}
                onRolloutBlur={handleRolloutBlur}
              />
            );
          })}
        </tbody>
      </table>
      {toggleMutation.isError && (
        <p className="text-sm text-red-700">{toggleMutation.error.message}</p>
      )}
      {updateMutation.isError && (
        <p className="text-sm text-red-700">{updateMutation.error.message}</p>
      )}
    </section>
  );
};

type EnvironmentRowProps = {
  state: FlagState;
  canManage: boolean;
  isArchived: boolean;
  isBusy: boolean;
  onToggle: (state: FlagState) => void;
  onTypeChange: (state: FlagState, type: FlagType) => void;
  onRolloutBlur: (state: FlagState, value: number) => void;
};

const EnvironmentRow = ({
  state,
  canManage,
  isArchived,
  isBusy,
  onToggle,
  onTypeChange,
  onRolloutBlur,
}: EnvironmentRowProps): React.ReactNode => {
  const [rolloutInput, setRolloutInput] = useState(state.rollout);

  const disabled = !canManage || isArchived || isBusy;

  return (
    <tr>
      <td className="py-2 pr-4 font-medium">{state.environmentName}</td>
      <td className="py-2 pr-4">
        <StatusBadge status={state.status} />
      </td>
      <td className="py-2 pr-4">
        <button
          type="button"
          onClick={() => onToggle(state)}
          disabled={disabled}
          aria-label={
            state.status === 'active'
              ? 'Deactivate in this environment'
              : 'Activate in this environment'
          }
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-40',
            state.status === 'active' ? 'bg-black' : 'bg-gray-200',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
              state.status === 'active' ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </td>
      <td className="py-2 pr-4">
        <select
          value={state.type}
          onChange={(e) => onTypeChange(state, e.target.value as FlagType)}
          disabled={disabled}
          className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          <option value="boolean">Boolean</option>
          <option value="percentage_rollout">Rollout %</option>
          <option value="targeted">Targeted</option>
        </select>
      </td>
      <td className="py-2">
        {state.type === 'percentage_rollout' && (
          <input
            type="number"
            min={0}
            max={100}
            value={rolloutInput}
            onChange={(e) => setRolloutInput(Number(e.target.value))}
            onBlur={() => onRolloutBlur(state, rolloutInput)}
            disabled={disabled}
            className="w-20 rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-40"
          />
        )}
      </td>
    </tr>
  );
};

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

type AuditLogSectionProps = { projectId: string; flagId: string };
const AuditLogSection = ({
  projectId,
  flagId,
}: AuditLogSectionProps): React.ReactNode => {
  const {
    data: entries,
    isPending,
    error,
    page,
    setPage,
    totalPages,
  } = useAuditLog(projectId, flagId);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Audit log
      </h2>

      {isPending && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-700">{error.message}</p>}

      {!isPending && !error && (
        <>
          {!entries || entries.length === 0 ? (
            <p className="text-sm text-gray-500">No events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Detail</th>
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => {
                  const detail = formatMeta(entry.action, entry.meta);
                  return (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4 font-medium">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{detail}</td>
                      <td className="py-2 pr-4 text-gray-500">
                        {entry.userName}
                      </td>
                      <td className="py-2">
                        <time
                          title={formatRelativeTime(entry.createdAt)}
                          className="text-xs text-gray-400"
                        >
                          {formatAbsoluteDate(entry.createdAt)}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
              ))}
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
    </section>
  );
};

type DangerSectionProps = {
  projectId: string;
  flagId: string;
  flagName: string;
  isArchived: boolean;
};
const DangerSection = ({
  projectId,
  flagId,
  flagName,
  isArchived,
}: DangerSectionProps): React.ReactNode => {
  const router = useRouter();
  const archiveMutation = useArchiveFlag(projectId, flagId);
  const unarchiveMutation = useUnarchiveFlag(projectId, flagId);
  const deleteMutation = useDeleteFlag(projectId);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const handleDelete = (): void => {
    if (deleteConfirm !== flagName) return;
    deleteMutation.mutate(flagId, {
      onSuccess: () => {
        router.push(`/projects/${projectId}/flags`);
      },
    });
  };

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Danger zone
      </h2>

      <div className="flex items-center gap-3">
        {!isArchived ? (
          <>
            <button
              type="button"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              className="rounded-md border border-yellow-400 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
            >
              {archiveMutation.isPending ? 'Archiving…' : 'Archive flag'}
            </button>
            {archiveMutation.isError && (
              <p className="text-sm text-red-700">
                {archiveMutation.error.message}
              </p>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => unarchiveMutation.mutate()}
              disabled={unarchiveMutation.isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {unarchiveMutation.isPending ? 'Unarchiving…' : 'Unarchive flag'}
            </button>
            {unarchiveMutation.isError && (
              <p className="text-sm text-red-700">
                {unarchiveMutation.error.message}
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">Delete this flag</p>
        <p className="text-xs text-red-700">
          Type <span className="font-mono font-semibold">{flagName}</span> to
          confirm. This action cannot be undone.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={flagName}
            className="rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteConfirm !== flagName || deleteMutation.isPending}
            className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
        {deleteMutation.isError && (
          <p className="text-sm text-red-700">{deleteMutation.error.message}</p>
        )}
      </div>
    </section>
  );
};

type RuleBuilderSectionProps = {
  projectId: string;
  flagId: string;
  state: FlagState;
};

type DraftRule = {
  attribute: string;
  operator: 'EQ' | 'NEQ' | 'IN' | 'NOT_IN' | 'CONTAINS';
  valueRaw: string;
};

const toDraftRule = (rule: TargetingRule): DraftRule => ({
  attribute: rule.attribute,
  operator: rule.operator,
  valueRaw: rule.value.join(', '),
});

const toTargetingRule = (draft: DraftRule): TargetingRule => ({
  attribute: draft.attribute,
  operator: draft.operator,
  value: draft.valueRaw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0),
});

const BLANK_RULE: DraftRule = {
  attribute: '',
  operator: 'EQ',
  valueRaw: '',
};

const RuleBuilderSection = ({
  projectId,
  flagId,
  state,
}: RuleBuilderSectionProps): React.ReactNode => {
  const [rules, setRules] = useState<DraftRule[]>(() =>
    state.rules.map(toDraftRule),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useUpdateFlagRules(projectId);

  const updateRule = (index: number, patch: Partial<DraftRule>): void => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const moveUp = (index: number): void => {
    if (index === 0) return;
    setRules((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
      return next;
    });
  };

  const moveDown = (index: number): void => {
    if (index === rules.length - 1) return;
    setRules((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
      return next;
    });
  };

  const removeRule = (index: number): void => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const addRule = (): void => {
    setRules((prev) => [...prev, { ...BLANK_RULE }]);
  };

  const handleSave = (): void => {
    setValidationError(null);
    for (const r of rules) {
      if (!r.attribute.trim()) {
        setValidationError('All rules must have an attribute.');
        return;
      }
      const value = r.valueRaw
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      if (value.length === 0) {
        setValidationError('All rules must have at least one value.');
        return;
      }
    }
    mutation.mutate({
      flagId,
      environmentId: state.environmentId,
      rules: rules.map(toTargetingRule),
    });
  };

  const busy = mutation.isPending;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Rules — {state.environmentName}
      </h2>

      {rules.length === 0 && (
        <p className="text-sm text-gray-400">No rules yet. Add one below.</p>
      )}

      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <input
              type="text"
              placeholder="attribute"
              value={rule.attribute}
              onChange={(e) => updateRule(i, { attribute: e.target.value })}
              disabled={busy}
              className="w-32 rounded border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:opacity-40"
            />
            <select
              value={rule.operator}
              onChange={(e) =>
                updateRule(i, {
                  operator: e.target.value as DraftRule['operator'],
                })
              }
              disabled={busy}
              className="rounded border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:opacity-40"
            >
              <option value="EQ">EQ</option>
              <option value="NEQ">NEQ</option>
              <option value="IN">IN</option>
              <option value="NOT_IN">NOT_IN</option>
              <option value="CONTAINS">CONTAINS</option>
            </select>
            <input
              type="text"
              placeholder={
                rule.operator === 'IN' || rule.operator === 'NOT_IN'
                  ? 'value1, value2'
                  : 'value'
              }
              value={rule.valueRaw}
              onChange={(e) => updateRule(i, { valueRaw: e.target.value })}
              disabled={busy}
              className="flex-1 rounded border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => moveUp(i)}
              disabled={busy || i === 0}
              aria-label="Move rule up"
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(i)}
              disabled={busy || i === rules.length - 1}
              aria-label="Move rule down"
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeRule(i)}
              disabled={busy}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRule}
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
        >
          Add rule
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save rules'}
        </button>
      </div>

      {validationError && (
        <p className="text-sm text-red-700">{validationError}</p>
      )}
      {mutation.isError && (
        <p className="text-sm text-red-700">{mutation.error.message}</p>
      )}
    </section>
  );
};

type StatusBadgeProps = { status: string };
const StatusBadge = ({ status }: StatusBadgeProps): React.ReactNode => {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    archived: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? map['inactive']}`}
    >
      {status}
    </span>
  );
};
