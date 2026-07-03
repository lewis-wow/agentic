import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { redirect, unauthorized } from 'next/navigation';

import { resolveAuthedUser } from '../../../lib/guards';
import { SetupForm } from './SetupForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage(): Promise<React.ReactNode> {
  const projectCount = await prisma.project.count();
  if (projectCount > 0) {
    redirect('/dashboard');
  }

  const user = await resolveAuthedUser();
  if (!user) {
    unauthorized();
  }

  if (user.role !== SYSTEM_ROLE.OWNER) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-2xl font-bold">Almost there</h1>
          <p className="text-sm text-gray-500">
            Waiting for the installation owner to finish setup. Ask them to sign
            in to create the first project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Welcome to Feature Flags</h1>
          <p className="text-sm text-gray-500">
            Create your first project to get started.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
