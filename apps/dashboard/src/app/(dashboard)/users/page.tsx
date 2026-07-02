import { requireOwner } from '../../../lib/guards';
import { SiteHeader } from '../SiteHeader';
import { UsersSection } from './UsersSection';

export const dynamic = 'force-dynamic';

export default async function UsersPage(): Promise<React.ReactNode> {
  // Owner-only route. Non-owners receive a 403 via forbidden().
  await requireOwner();

  return (
    <>
      <SiteHeader crumbs={[{ label: 'Users' }]} />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Everyone registered in this installation.
          </p>
        </div>
        <UsersSection />
      </div>
    </>
  );
}
