'use client';

import { useActionState } from 'react';

import { createProjectAction, type ProjectActionState } from './actions.js';

const initialState: ProjectActionState = {};

export const CreateProjectForm = (): React.ReactNode => {
  const [state, action, isPending] = useActionState(
    createProjectAction,
    initialState,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input
        type="text"
        name="name"
        required
        placeholder="New project name"
        className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Creating…' : 'Create'}
      </button>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
};
