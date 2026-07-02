'use client';

import { DataTable } from '@repo/ui/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { useActionState, useMemo, useState } from 'react';

import {
  createEnvironmentAction,
  deleteEnvironmentAction,
  type EnvironmentActionState,
  rotateApiKeyAction,
} from './environment-actions';

type Environment = {
  id: string;
  name: string;
  apiKeyId: string;
};

type Props = {
  projectId: string;
  canManage: boolean;
  environments: Environment[];
};

const initialState: EnvironmentActionState = {};

export const EnvironmentsPanel = ({
  projectId,
  canManage,
  environments,
}: Props): React.ReactNode => {
  const [createState, createAction, isCreating] = useActionState(
    createEnvironmentAction,
    initialState,
  );

  const columns: ColumnDef<Environment>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Environment',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-xs text-gray-400">
              ID: {row.original.apiKeyId}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <EnvironmentActions
            environment={row.original}
            projectId={projectId}
            canManage={canManage}
          />
        ),
      },
    ],
    [projectId, canManage],
  );

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Environments
      </h2>

      {createState.fullKey && (
        <ApiKeyReveal
          fullKey={createState.fullKey}
          label="New environment created"
        />
      )}

      <DataTable
        columns={columns}
        data={environments}
        emptyMessage="No environments yet."
      />

      {canManage && (
        <form action={createAction} className="flex items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input
            type="text"
            name="name"
            required
            placeholder="New environment name"
            className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isCreating ? 'Creating…' : 'Add environment'}
          </button>
          {createState.error && (
            <p className="text-sm text-red-700">{createState.error}</p>
          )}
        </form>
      )}
    </section>
  );
};

type EnvironmentActionsProps = {
  environment: Environment;
  projectId: string;
  canManage: boolean;
};

const EnvironmentActions = ({
  environment,
  projectId,
  canManage,
}: EnvironmentActionsProps): React.ReactNode => {
  const [rotateState, rotateAction, isRotating] = useActionState(
    rotateApiKeyAction,
    initialState,
  );
  const [showDelete, setShowDelete] = useState(false);

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <form action={rotateAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="environmentId" value={environment.id} />
          <button
            type="submit"
            disabled={isRotating}
            className="text-xs text-gray-600 hover:underline disabled:opacity-50"
          >
            {isRotating ? 'Rotating…' : 'Rotate key'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowDelete((v) => !v)}
          className="text-xs text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>

      {rotateState.error && (
        <p className="text-sm text-red-700">{rotateState.error}</p>
      )}

      {rotateState.fullKey && (
        <ApiKeyReveal fullKey={rotateState.fullKey} label="API key rotated" />
      )}

      {showDelete && (
        <DeleteEnvironmentForm
          projectId={projectId}
          environmentId={environment.id}
          environmentName={environment.name}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
};

type DeleteEnvironmentFormProps = {
  projectId: string;
  environmentId: string;
  environmentName: string;
  onCancel: () => void;
};

const DeleteEnvironmentForm = ({
  projectId,
  environmentId,
  environmentName,
  onCancel,
}: DeleteEnvironmentFormProps): React.ReactNode => {
  const [confirmation, setConfirmation] = useState('');
  const [state, action, isPending] = useActionState(
    deleteEnvironmentAction,
    initialState,
  );

  return (
    <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-gray-600">
        Type <span className="font-mono font-semibold">{environmentName}</span>{' '}
        to confirm deletion. All flag states will be permanently removed.
      </p>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="environmentId" value={environmentId} />
        <input type="hidden" name="expectedName" value={environmentName} />
        <input
          type="text"
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={environmentName}
          className="rounded-md border px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
          type="submit"
          disabled={isPending || confirmation !== environmentName}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </form>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
    </div>
  );
};

type ApiKeyRevealProps = {
  fullKey: string;
  label: string;
};

const ApiKeyReveal = ({
  fullKey,
  label,
}: ApiKeyRevealProps): React.ReactNode => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3">
      <p className="text-xs font-medium text-green-800">
        {label} — copy your API key now. It won&apos;t be shown again.
      </p>
      <div className="flex items-center gap-2">
        <pre className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-xs text-gray-800">
          {fullKey}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};
