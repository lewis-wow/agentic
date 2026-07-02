'use client';

import { ApiKeysPanel } from '@/components/api-keys/api-keys-panel';
import { EnvironmentsPanel } from '@/components/environments/environments-panel';
import { FlagsTable } from '@/components/flags/flags-table';
import { SiteHeader } from '@/components/site-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useStore,
  useProject,
  useProjectEnvironments,
  useProjectFlags,
  useProjectApiKeys,
} from '@/lib/store';
import {
  Flag,
  Layers,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderKanban,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

function EditProjectDialog({
  projectId,
  name: initialName,
  description: initialDescription,
  open,
  onOpenChange,
}: {
  projectId: string;
  name: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateProject } = useStore();
  const [name, setName] = React.useState(initialName);
  const [description, setDescription] = React.useState(initialDescription);

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    updateProject(projectId, {
      name: name.trim(),
      description: description.trim(),
    });
    toast.success('Project updated');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update the project name and description.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="edit-project-name">Name</FieldLabel>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-project-description">
                Description
              </FieldLabel>
              <Textarea
                id="edit-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const project = useProject(projectId);
  const environments = useProjectEnvironments(projectId);
  const flags = useProjectFlags(projectId);
  const apiKeys = useProjectApiKeys(projectId);
  const { deleteProject } = useStore();

  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  if (!project) {
    return (
      <>
        <SiteHeader
          crumbs={[
            { label: 'Projects', href: '/projects' },
            { label: 'Not found' },
          ]}
        />
        <div className="p-4 md:p-6">
          <Empty className="rounded-lg border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanban />
              </EmptyMedia>
              <EmptyTitle>Project not found</EmptyTitle>
              <EmptyDescription>
                This project may have been deleted. Head back to your projects
                list.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => router.push('/projects')}>
              Back to projects
            </Button>
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        crumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
      />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {project.description || 'No description'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{flags.length} flags</Badge>
              <Badge variant="outline">
                {environments.length} environments
              </Badge>
              <Badge variant="outline">{apiKeys.length} API keys</Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon">
                  <MoreHorizontal />
                  <span className="sr-only">Project settings</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil />
                Edit project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs defaultValue="flags">
          <TabsList>
            <TabsTrigger value="flags">
              <Flag data-icon="inline-start" />
              Flags
            </TabsTrigger>
            <TabsTrigger value="environments">
              <Layers data-icon="inline-start" />
              Environments
            </TabsTrigger>
            <TabsTrigger value="api-keys">
              <KeyRound data-icon="inline-start" />
              API Keys
            </TabsTrigger>
          </TabsList>
          <TabsContent value="flags" className="mt-4">
            <FlagsTable projectId={projectId} />
          </TabsContent>
          <TabsContent value="environments" className="mt-4">
            <EnvironmentsPanel projectId={projectId} />
          </TabsContent>
          <TabsContent value="api-keys" className="mt-4">
            <ApiKeysPanel projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>

      <EditProjectDialog
        projectId={project.id}
        name={project.name}
        description={project.description}
        open={editing}
        onOpenChange={setEditing}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{project.name}</strong> and all of its environments,
              flags, and API keys will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deleteProject(project.id);
                toast.success('Project deleted', { description: project.name });
                setDeleting(false);
                router.push('/projects');
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
