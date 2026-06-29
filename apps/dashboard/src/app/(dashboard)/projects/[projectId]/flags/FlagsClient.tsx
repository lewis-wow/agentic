'use client';

import { useState } from 'react';

import {
  useCreateFlag,
  useEnvironments,
  useFlags,
  useToggleFlag,
  type Environment,
  type FlagListItem,
} from '../../../../../queries/flags.js';

type Props = {
  projectId: string;
  canManage: boolean;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const FlagsClient = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const { data: environments, isPending: envsLoading } =
    useEnvironments(projectId);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);

  const currentEnvId =
    selectedEnvId ??
    (environments && environments[0] ? environments[0].id : null);

  const { data: flags, isPending: flagsLoading } = useFlags(
    projectId,
    currentEnvId,
  );

  const toggleMutation = useToggleFlag(projectId);

  const handleToggle = (flag: FlagListItem): void => {
    if (!currentEnvId) return;
    const next = flag.status === 'active' ? 'inactive' : 'active';
    toggleMutation.mutate({
      flagId: flag.id,
      environmentId: currentEnvId,
      status: next,
    });
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
      <EnvironmentSelector
        environments={environments}
        selectedId={currentEnvId ?? ''}
        onChange={setSelectedEnvId}
      />

      {flagsLoading ? (
        <p className="text-sm text-gray-500">Loading flags…</p>
      ) : !flags || flags.length === 0 ? (
        <p className="text-sm text-gray-500">No flags yet.</p>
      ) : (
        <ul className="space-y-2">
          {flags.map((flag) => (
            <FlagRow
              key={flag.id}
              projectId={projectId}
              flag={flag}
              canManage={canManage}
              onToggle={() => handleToggle(flag)}
              isToggling={
                toggleMutation.isPending &&
                toggleMutation.variables?.flagId === flag.id
              }
              toggleError={
                toggleMutation.isError &&
                toggleMutation.variables?.flagId === flag.id
                  ? toggleMutation.error.message
                  : null
              }
            />
          ))}
        </ul>
      )}

      {canManage && currentEnvId && <CreateFlagForm projectId={projectId} />}
    </div>
  );
};

type EnvironmentSelectorProps = {
  environments: Environment[];
  selectedId: string;
  onChange: (id: string) => void;
};

const EnvironmentSelector = ({
  environments,
  selectedId,
  onChange,
}: EnvironmentSelectorProps): React.ReactNode => (
  <div className="flex items-center gap-3">
    <label htmlFor="env-select" className="text-sm font-medium text-gray-700">
      Environment:
    </label>
    <select
      id="env-select"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black"
    >
      {environments.map((env) => (
        <option key={env.id} value={env.id}>
          {env.name}
        </option>
      ))}
    </select>
  </div>
);

type FlagRowProps = {
  projectId: string;
  flag: FlagListItem;
  canManage: boolean;
  onToggle: () => void;
  isToggling: boolean;
  toggleError: string | null;
};

const FlagRow = ({
  projectId,
  flag,
  canManage,
  onToggle,
  isToggling,
  toggleError,
}: FlagRowProps): React.ReactNode => {
  const isArchived = flag.status === 'archived';

  return (
    <li className="flex flex-col gap-1 rounded-md border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <a
            href={`/projects/${projectId}/flags/${flag.id}`}
            className="text-sm font-medium hover:underline"
          >
            {flag.name}
          </a>
          <p className="font-mono text-xs text-gray-400">{flag.key}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={flag.status} />
          <button
            type="button"
            onClick={onToggle}
            disabled={!canManage || isArchived || isToggling}
            aria-label={
              flag.status === 'active' ? 'Deactivate flag' : 'Activate flag'
            }
            className={[
              'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
              'disabled:cursor-not-allowed disabled:opacity-40',
              flag.status === 'active' ? 'bg-black' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
                flag.status === 'active' ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>
      </div>
      {toggleError && <p className="text-xs text-red-700">{toggleError}</p>}
    </li>
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

type CreateFlagFormProps = { projectId: string };
const CreateFlagForm = ({
  projectId,
}: CreateFlagFormProps): React.ReactNode => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  const mutation = useCreateFlag(projectId);

  const handleNameChange = (value: string): void => {
    setName(value);
    if (!keyTouched) {
      setKey(slugify(value));
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!name || !key) return;
    mutation.mutate(
      { name, key },
      {
        onSuccess: () => {
          setName('');
          setKey('');
          setKeyTouched(false);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Create flag</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1 space-y-1">
          <label htmlFor="flag-name" className="block text-xs text-gray-600">
            Name
          </label>
          <input
            id="flag-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="My feature"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="flag-key" className="block text-xs text-gray-600">
            Key
          </label>
          <input
            id="flag-key"
            type="text"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setKeyTouched(true);
            }}
            required
            placeholder="my-feature"
            pattern="^[a-z0-9-]+$"
            title="Lowercase letters, digits, and hyphens only"
            className="w-full rounded-md border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-700">{mutation.error.message}</p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {mutation.isPending ? 'Creating…' : 'Create flag'}
      </button>
    </form>
  );
};
