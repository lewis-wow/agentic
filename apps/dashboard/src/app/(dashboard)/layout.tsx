import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@repo/ui/components/ui/sidebar';

import { requireSession } from '../../lib/guards';
import { AppSidebar, type SidebarProject } from './AppSidebar';
import { LogoutButton } from './LogoutButton';
import { Providers } from './providers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  const user = await requireSession();
  const isOwner = user.role === SYSTEM_ROLE.OWNER;

  const projects = isOwner
    ? await prisma.project.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          environments: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true },
          },
        },
      })
    : await prisma.project.findMany({
        where: { members: { some: { userId: user.id } } },
        orderBy: { createdAt: 'asc' },
        include: {
          environments: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true },
          },
        },
      });

  const sidebarProjects: SidebarProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    environments: project.environments,
  }));

  return (
    <Providers>
      <SidebarProvider>
        <AppSidebar projects={sidebarProjects} isOwner={isOwner} />
        <SidebarInset>
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">{user.email}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {user.role}
              </span>
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </Providers>
  );
}
