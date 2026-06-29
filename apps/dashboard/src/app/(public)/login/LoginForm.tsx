'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authClient } from '../../../lib/auth-client.js';

export const LoginForm = (): React.ReactNode => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement)
      .value;

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? 'Invalid credentials.');
      setPending(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

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
          autoComplete="current-password"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
};
