import { redirect } from 'next/navigation';

import { getSession } from '../../lib/session.js';
import { LogoutButton } from './LogoutButton.js';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Feature Flags</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">{session.user.email}</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">
            {session.user.role as string}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
