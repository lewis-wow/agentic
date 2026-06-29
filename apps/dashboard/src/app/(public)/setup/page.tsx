import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

import { SetupForm } from './SetupForm.js';

export const dynamic = 'force-dynamic';

export default async function SetupPage(): Promise<React.ReactNode> {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Welcome to Feature Flags</h1>
          <p className="text-sm text-gray-500">
            Create your owner account and first project to get started.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
