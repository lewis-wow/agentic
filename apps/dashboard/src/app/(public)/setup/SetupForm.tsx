'use client';

import { useActionState } from 'react';

import { setupAction, type SetupActionState } from './actions';

const initialState: SetupActionState = {};

export const SetupForm = (): React.ReactNode => {
  const [state, formAction, pending] = useActionState(
    setupAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="projectName" className="block text-sm font-medium">
          First project name
        </label>
        <input
          id="projectName"
          name="projectName"
          type="text"
          required
          placeholder="e.g. My App"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create project'}
      </button>
    </form>
  );
};
