'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@repo/ui/components/ui/sidebar';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  FlagIcon,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useProjects } from '../../queries/projects';
import { CreateProjectDialog } from './CreateProjectDialog';
import { LogoutButton } from './LogoutButton';

type Props = {
  isOwner: boolean;
  userEmail: string;
  userRole: string;
  logoutUrl?: string;
};

export const AppSidebar = ({
  isOwner,
  userEmail,
  userRole,
  logoutUrl,
}: Props): React.ReactNode => {
  const pathname = usePathname();
  const { data: projects = [], isPending } = useProjects();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FlagIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Flagship</span>
                  <span className="text-xs text-sidebar-foreground/70">
                    Feature Flags
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard'}>
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/settings'}>
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          {isOwner && (
            <CreateProjectDialog
              trigger={
                <SidebarGroupAction title="New project">
                  <Plus />
                  <span className="sr-only">New project</span>
                </SidebarGroupAction>
              }
            />
          )}
          <SidebarMenu>
            {isPending ? (
              <>
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full" />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full" />
                </SidebarMenuItem>
              </>
            ) : (
              <>
                {projects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/projects/${project.id}`}
                    >
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium"
                      >
                        <FolderKanban />
                        <span>{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {projects.length === 0 && (
                  <SidebarMenuItem>
                    <span className="px-2 text-sm text-sidebar-foreground/60">
                      No projects yet.
                    </span>
                  </SidebarMenuItem>
                )}
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/users'}>
                  <Link href="/users">
                    <Users />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sidebar-foreground">
              {userEmail}
            </span>
            <Badge variant="secondary" className="w-fit text-[10px]">
              {userRole}
            </Badge>
          </div>
          {logoutUrl && <LogoutButton logoutUrl={logoutUrl} />}
        </div>
        <div className="px-2 pb-1 text-[11px] text-sidebar-foreground/50">
          {isPending ? (
            <Skeleton className="h-3 w-16" />
          ) : (
            `${projects.length} project${projects.length === 1 ? '' : 's'}`
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
