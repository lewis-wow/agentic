import { SYSTEM_ROLE } from '@repo/auth/roles';
import Link from 'next/link';

import { requireSession } from '../../lib/guards';
import { LogoutButton } from './LogoutButton';
import { Providers } from './providers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  const user = await requireSession();
  const isOwner = user.role === SYSTEM_ROLE.OWNER;

  return (
    <Providers>
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold">
              Feature Flags
            </Link>
            {isOwner && (
              <Link href="/users" className="text-gray-500 hover:text-black">
                Users
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{user.email}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {user.role}
            </span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </Providers>
  );
}
