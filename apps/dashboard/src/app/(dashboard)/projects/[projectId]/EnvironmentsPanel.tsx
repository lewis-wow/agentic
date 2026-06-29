'use client';

import { useActionState, useState } from 'react';

import {
  createEnvironmentAction,
  deleteEnvironmentAction,
  type EnvironmentActionState,
  rotateApiKeyAction,
} from './environment-actions.js';

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

      <ul className="space-y-2">
        {environments.map((env) => (
          <EnvironmentRow
            key={env.id}
            environment={env}
            projectId={projectId}
            canManage={canManage}
          />
        ))}
        {environments.length === 0 && (
          <li className="text-sm text-gray-500">No environments yet.</li>
        )}
      </ul>

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

type EnvironmentRowProps = {
  environment: Environment;
  projectId: string;
  canManage: boolean;
};

const EnvironmentRow = ({
  environment,
  projectId,
  canManage,
}: EnvironmentRowProps): React.ReactNode => {
  const [rotateState, rotateAction, isRotating] = useActionState(
    rotateApiKeyAction,
    initialState,
  );
  const [showDelete, setShowDelete] = useState(false);

  return (
    <li className="space-y-2 rounded-md border px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{environment.name}</span>
        {canManage && (
          <div className="flex items-center gap-3">
            <form action={rotateAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="hidden"
                name="environmentId"
                value={environment.id}
              />
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
        )}
      </div>

      <p className="font-mono text-xs text-gray-400">
        ID: {environment.apiKeyId}
      </p>

      {rotateState.error && (
        <p className="text-sm text-red-700">{rotateState.error}</p>
      )}

      {rotateState.fullKey && (
        <ApiKeyReveal fullKey={rotateState.fullKey} label="API key rotated" />
      )}

      {showDelete && canManage && (
        <DeleteEnvironmentForm
          projectId={projectId}
          environmentId={environment.id}
          environmentName={environment.name}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </li>
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
