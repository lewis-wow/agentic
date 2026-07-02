import { requireOwner } from '../../../lib/guards';
import { UsersSection } from './UsersSection';

export const dynamic = 'force-dynamic';

export default async function UsersPage(): Promise<React.ReactNode> {
  // Owner-only route. Non-owners receive a 403 via forbidden().
  await requireOwner();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <UsersSection />
    </div>
  );
}
