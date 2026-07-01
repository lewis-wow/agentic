import { prisma } from '@repo/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '../../../lib/session';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ setup?: string }>;
};

export default async function LoginPage({
  searchParams,
}: Props): Promise<React.ReactNode> {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const justSetup = params.setup === 'done';

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          {justSetup && (
            <p className="text-sm text-green-600">
              Account created! Sign in with your credentials.
            </p>
          )}
        </div>
        <LoginForm />
        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
