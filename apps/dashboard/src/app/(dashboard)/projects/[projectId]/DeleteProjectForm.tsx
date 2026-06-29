'use client';

import { useActionState, useState } from 'react';

import {
  deleteProjectAction,
  type ProjectActionState,
} from '../../dashboard/actions.js';

type Props = {
  projectId: string;
  projectName: string;
};

const initialState: ProjectActionState = {};

export const DeleteProjectForm = ({
  projectId,
  projectName,
}: Props): React.ReactNode => {
  const [confirmation, setConfirmation] = useState('');
  const [state, action, isPending] = useActionState(
    deleteProjectAction,
    initialState,
  );

  return (
    <section className="space-y-3 rounded-md border border-red-200 p-4">
      <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
      <p className="text-sm text-gray-600">
        Deleting this project is permanent. All environments, flags, and members
        will be removed. Type{' '}
        <span className="font-mono font-semibold">{projectName}</span> to
        confirm.
      </p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="expectedName" value={projectName} />
        <input
          type="text"
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={projectName}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
          type="submit"
          disabled={isPending || confirmation !== projectName}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isPending ? 'Deleting…' : 'Delete project'}
        </button>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      </form>
    </section>
  );
};
