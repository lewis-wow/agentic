'use client';

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  slugify,
  useStore,
  useProjectApiKeys,
  useProjectEnvironments,
  useProjectFlags,
} from '@/lib/store';
import type { Environment } from '@/lib/types';
import { Plus, Layers, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

function CreateEnvironmentDialog({ projectId }: { projectId: string }) {
  const { createEnvironment } = useStore();
  const existing = useProjectEnvironments(projectId);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');

  const key = slugify(name);
  const duplicate = existing.some((e) => e.key === key);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || duplicate) return;
    createEnvironment(projectId, { name: name.trim() });
    toast.success('Environment created', { description: name.trim() });
    setName('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" />
            New Environment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create environment</DialogTitle>
            <DialogDescription>
              Existing flags will be added to this environment, disabled by
              default.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field data-invalid={duplicate || undefined}>
              <FieldLabel htmlFor="env-name">Name</FieldLabel>
              <Input
                id="env-name"
                value={name}
                aria-invalid={duplicate || undefined}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Staging"
                autoFocus
              />
              <FieldDescription>
                {duplicate
                  ? 'An environment with this key already exists.'
                  : key
                    ? `Key: ${key}`
                    : 'A URL-friendly key is generated automatically.'}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!name.trim() || duplicate}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EnvironmentsPanel({ projectId }: { projectId: string }) {
  const environments = useProjectEnvironments(projectId);
  const flags = useProjectFlags(projectId);
  const apiKeys = useProjectApiKeys(projectId);
  const { deleteEnvironment } = useStore();
  const [deleting, setDeleting] = React.useState<Environment | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Environments</h2>
          <p className="text-sm text-muted-foreground">
            Each environment maintains its own flag values and API keys.
          </p>
        </div>
        <CreateEnvironmentDialog projectId={projectId} />
      </div>

      {environments.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>No environments</EmptyTitle>
            <EmptyDescription>
              Add an environment to start rolling out flags.
            </EmptyDescription>
          </EmptyHeader>
          <CreateEnvironmentDialog projectId={projectId} />
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {environments.map((env) => {
            const enabledCount = flags.filter(
              (f) => f.states[env.id]?.enabled,
            ).length;
            const keyCount = apiKeys.filter(
              (k) => k.environmentId === env.id,
            ).length;
            return (
              <Card key={env.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: env.color }}
                    />
                    <CardTitle className="text-base">{env.name}</CardTitle>
                  </div>
                  <CardDescription>
                    <code className="text-xs">{env.key}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{enabledCount} enabled</Badge>
                    <Badge variant="outline">{keyCount} keys</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(env)}
                  >
                    <Trash2 />
                    <span className="sr-only">Delete environment</span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete environment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  Deleting <strong>{deleting.name}</strong> removes its flag
                  values and all API keys scoped to it. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  deleteEnvironment(deleting.id);
                  toast.success('Environment deleted', {
                    description: deleting.name,
                  });
                }
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
