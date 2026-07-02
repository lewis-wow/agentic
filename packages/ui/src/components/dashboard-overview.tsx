'use client';

import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useStore } from '@/lib/store';
import { FolderKanban, Flag, Layers, KeyRound, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <Icon className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function DashboardOverview() {
  const { projects, environments, flags, apiKeys } = useStore();

  const enabledCount = flags.reduce(
    (acc, f) => acc + Object.values(f.states).filter((s) => s.enabled).length,
    0,
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your projects, environments, and feature flags.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={projects.length}
          icon={FolderKanban}
        />
        <StatCard
          label="Environments"
          value={environments.length}
          icon={Layers}
        />
        <StatCard label="Feature Flags" value={flags.length} icon={Flag} />
        <StatCard label="API Keys" value={apiKeys.length} icon={KeyRound} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            {enabledCount} flag rollout{enabledCount === 1 ? '' : 's'} currently
            enabled across all environments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanban />
                </EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>
                  Create your first project to start managing feature flags.
                </EmptyDescription>
              </EmptyHeader>
              <CreateProjectDialog />
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => {
                const projectEnvs = environments.filter(
                  (e) => e.projectId === project.id,
                );
                const projectFlags = flags.filter(
                  (f) => f.projectId === project.id,
                );
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{project.name}</span>
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {project.description || 'No description'}
                        </span>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {projectFlags.length} flags
                      </Badge>
                      <Badge variant="outline">
                        {projectEnvs.length} environments
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
