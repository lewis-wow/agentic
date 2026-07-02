'use client';

import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useStore } from '@/lib/store';
import { Flag, LayoutDashboard, FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppSidebar() {
  const pathname = usePathname();
  const { projects } = useStore();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Flag className="size-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold">Flagship</span>
            <span className="text-xs text-muted-foreground">Feature Flags</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === '/'}
                  tooltip="Dashboard"
                  render={<Link href="/" />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === '/projects'}
                  tooltip="Projects"
                  render={<Link href="/projects" />}
                >
                  <FolderKanban />
                  <span>Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <CreateProjectDialog
            trigger={
              <SidebarGroupAction title="New project">
                <Plus />
                <span className="sr-only">New project</span>
              </SidebarGroupAction>
            }
          />
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map((project) => {
                const href = `/projects/${project.id}`;
                return (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(href)}
                      tooltip={project.name}
                      render={<Link href={href} />}
                    >
                      <FolderKanban />
                      <span>{project.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {projects.length} project{projects.length === 1 ? '' : 's'} ·
          in-memory demo
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
