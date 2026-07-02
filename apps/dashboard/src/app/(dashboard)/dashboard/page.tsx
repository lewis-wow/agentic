import { SYSTEM_ROLE } from '@repo/auth/roles';

import { requireSession } from '../../../lib/guards';
import { SiteHeader } from '../SiteHeader';
import { DashboardOverview } from './DashboardOverview';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<React.ReactNode> {
  const user = await requireSession();
  const isOwner = user.role === SYSTEM_ROLE.OWNER;

  return (
    <>
      <SiteHeader crumbs={[{ label: 'Dashboard' }]} />
      <DashboardOverview isOwner={isOwner} />
    </>
  );
}
