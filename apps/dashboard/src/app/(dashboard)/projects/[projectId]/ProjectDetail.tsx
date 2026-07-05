'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import {
  Flag,
  KeyRound,
  Layers,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useApiKeys } from '../../../../queries/apiKeys';
import { useFlags } from '../../../../queries/flags';
import { useProject } from '../../../../queries/projects';
import { SiteHeader } from '../../SiteHeader';
import { ApiKeysPanel } from './ApiKeysPanel';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { RenameProjectDialog } from './RenameProjectDialog';
import { FlagsClient } from './flags/FlagsClient';

type Props = {
  projectId: string;
  isOwner: boolean;
  canManage: boolean;
  projectRole: string;
};

export const ProjectDetail = ({
  projectId,
  isOwner,
  canManage,
  projectRole,
}: Props): React.ReactNode => {
  const { data: project, isPending: projectPending } = useProject(projectId);
  const searchParams = useSearchParams();
  const environmentId = searchParams.get('environmentId');
  const firstEnvironmentId = project?.environments[0]?.id ?? null;
  const { total: flagsTotal, isPending: flagsPending } = useFlags(
    projectId,
    environmentId ?? firstEnvironmentId,
  );
  const { total: apiKeysTotal, isPending: apiKeysPending } =
    useApiKeys(projectId);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const environmentCount = project?.environments.length ?? 0;

  return (
    <>
      <SiteHeader
        crumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: project?.name ?? 'Project' },
        ]}
      />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {project ? (
              <h1 className="text-2xl font-semibold tracking-tight">
                {project.name}
              </h1>
            ) : (
              <Skeleton className="h-8 w-48" />
            )}
            <p className="text-sm text-muted-foreground">
              Your access: <span className="font-medium">{projectRole}</span>
            </p>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal />
                  <span className="sr-only">Project actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <Pencil />
                  Rename project
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 />
                    Delete project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {flagsPending ? (
            <Skeleton className="h-5 w-16 rounded-full" />
          ) : (
            <Badge variant="secondary">{flagsTotal} flags</Badge>
          )}
          {projectPending ? (
            <Skeleton className="h-5 w-28 rounded-full" />
          ) : (
            <Badge variant="secondary">{environmentCount} environments</Badge>
          )}
          {apiKeysPending ? (
            <Skeleton className="h-5 w-24 rounded-full" />
          ) : (
            <Badge variant="secondary">{apiKeysTotal} API keys</Badge>
          )}
        </div>

        <Tabs defaultValue="flags">
          <TabsList>
            <TabsTrigger value="flags">
              <Flag />
              Flags
            </TabsTrigger>
            <TabsTrigger value="environments">
              <Layers />
              Environments
            </TabsTrigger>
            <TabsTrigger value="api-keys">
              <KeyRound />
              API Keys
            </TabsTrigger>
          </TabsList>
          <TabsContent value="flags" className="pt-4">
            <FlagsClient
              projectId={projectId}
              canManage={canManage}
              environmentId={environmentId}
            />
          </TabsContent>
          <TabsContent value="environments" className="pt-4">
            <EnvironmentsPanel projectId={projectId} canManage={canManage} />
          </TabsContent>
          <TabsContent value="api-keys" className="pt-4">
            <ApiKeysPanel projectId={projectId} canManage={canManage} />
          </TabsContent>
        </Tabs>

        {project && (
          <>
            <RenameProjectDialog
              projectId={projectId}
              projectName={project.name}
              open={renaming}
              onOpenChange={setRenaming}
            />
            <DeleteProjectDialog
              projectId={projectId}
              projectName={project.name}
              open={deleting}
              onOpenChange={setDeleting}
            />
          </>
        )}
      </div>
    </>
  );
};
