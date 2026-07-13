import { SYSTEM_ROLE } from '@repo/auth/roles';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { redirect } from 'next/navigation';

import { env } from '../../env';
import { projectsExist, requireSession } from '../../lib/guards';
import { AppSidebar } from './AppSidebar';
import { Providers } from './providers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  const user = await requireSession();

  const exists = await projectsExist();
  if (!exists) {
    redirect('/setup');
  }

  const isOwner = user.role === SYSTEM_ROLE.OWNER;

  return (
    <Providers>
      <SidebarProvider>
        <AppSidebar
          isOwner={isOwner}
          userEmail={user.email}
          userRole={user.role}
          logoutUrl={env.TRUSTED_PROXY_LOGOUT_URL || undefined}
        />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </Providers>
  );
}
