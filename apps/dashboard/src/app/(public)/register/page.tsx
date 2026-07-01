import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

import { getSession } from '../../../lib/session';
import { RegisterForm } from './RegisterForm';

export const dynamic = 'force-dynamic';

export default async function RegisterPage(): Promise<React.ReactNode> {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-gray-500">
            You&apos;ll get access to projects once an owner or admin invites
            you.
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
