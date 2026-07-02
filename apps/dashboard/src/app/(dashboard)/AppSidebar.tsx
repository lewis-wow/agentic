'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@repo/ui/components/ui/sidebar';
import { FlagIcon, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { useProjects } from '../../queries/projects';

type Props = {
  isOwner: boolean;
};

export const AppSidebar = ({ isOwner }: Props): React.ReactNode => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentEnvironmentId = searchParams.get('environmentId');
  const { data: projects = [] } = useProjects();

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
                  <span className="font-medium">Feature Flags</span>
                  <span className="text-xs text-sidebar-foreground/70">
                    Dashboard
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            {projects.map((project) => {
              const isProjectActive = pathname === `/projects/${project.id}`;
              return (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton asChild isActive={isProjectActive}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium"
                    >
                      {project.name}
                    </Link>
                  </SidebarMenuButton>
                  {project.environments.length > 0 && (
                    <SidebarMenuSub>
                      {project.environments.map((environment) => {
                        const isEnvironmentActive =
                          pathname === `/projects/${project.id}/flags` &&
                          currentEnvironmentId === environment.id;
                        return (
                          <SidebarMenuSubItem key={environment.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isEnvironmentActive}
                            >
                              <Link
                                href={`/projects/${project.id}/flags?environmentId=${environment.id}`}
                              >
                                {environment.name}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
            {projects.length === 0 && (
              <SidebarMenuItem>
                <span className="px-2 text-sm text-sidebar-foreground/60">
                  No projects yet.
                </span>
              </SidebarMenuItem>
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
      <SidebarRail />
    </Sidebar>
  );
};
