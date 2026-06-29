import { prisma } from '@repo/prisma';

import { requireOwner } from '../../../lib/guards.js';

export const dynamic = 'force-dynamic';

export default async function UsersPage(): Promise<React.ReactNode> {
  // Owner-only route. Non-owners receive a 403 via forbidden().
  await requireOwner();

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <ul className="space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex items-center justify-between rounded-md border px-4 py-3 text-sm"
          >
            <span>
              {user.name}{' '}
              <span className="text-gray-500">&lt;{user.email}&gt;</span>
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {user.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
