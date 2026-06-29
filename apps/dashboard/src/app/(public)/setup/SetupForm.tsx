'use client';

import { useActionState } from 'react';

import { setupAction, type SetupActionState } from './actions.js';

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
        <label htmlFor="name" className="block text-sm font-medium">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
      </div>

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
        className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create account & project'}
      </button>
    </form>
  );
};
