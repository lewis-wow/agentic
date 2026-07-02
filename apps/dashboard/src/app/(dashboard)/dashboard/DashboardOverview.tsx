'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { ArrowRight, FolderKanban, Layers } from 'lucide-react';
import Link from 'next/link';

import { useProjects } from '../../../queries/projects';
import { CreateProjectDialog } from '../CreateProjectDialog';

type StatCardProps = {
  label: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
};

const StatCard = ({
  label,
  value,
  icon: Icon,
}: StatCardProps): React.ReactNode => (
  <Card>
    <CardHeader>
      <CardDescription>{label}</CardDescription>
      {value === null ? (
        <Skeleton className="h-9 w-12" />
      ) : (
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      )}
    </CardHeader>
    <CardContent>
      <Icon className="size-5 text-muted-foreground" />
    </CardContent>
  </Card>
);

const ProjectCardSkeleton = (): React.ReactNode => (
  <div className="rounded-lg border p-4">
    <div className="flex items-start justify-between gap-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="size-4 shrink-0" />
    </div>
    <Skeleton className="mt-3 h-5 w-28 rounded-full" />
  </div>
);

type Props = {
  isOwner: boolean;
};

export const DashboardOverview = ({ isOwner }: Props): React.ReactNode => {
  const { data: projects = [], isPending } = useProjects();
  const environmentCount = projects.reduce(
    (acc, project) => acc + project.environments.length,
    0,
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your projects and environments.
          </p>
        </div>
        {isOwner && <CreateProjectDialog />}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={isPending ? null : projects.length}
          icon={FolderKanban}
        />
        <StatCard
          label="Environments"
          value={isPending ? null : environmentCount}
          icon={Layers}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            {isOwner
              ? 'All projects in this installation.'
              : 'Projects you have access to.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
            </div>
          ) : projects.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanban />
                </EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>
                  {isOwner
                    ? 'Create your first project to start managing feature flags.'
                    : 'Ask an owner to grant you access to a project.'}
                </EmptyDescription>
              </EmptyHeader>
              {isOwner && <CreateProjectDialog />}
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{project.name}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {project.environments.length} environments
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
