import { prisma } from '@repo/prisma';

import { requireOwner } from '../../../lib/guards';
import { UsersTable } from './UsersTable';

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
      <UsersTable users={users} />
    </div>
  );
}
