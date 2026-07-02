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
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useStore,
  useProjectApiKeys,
  useProjectEnvironments,
} from '@/lib/store';
import type { ApiKey } from '@/lib/types';
import { Plus, KeyRound, Eye, EyeOff, Copy, Check, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function maskToken(token: string) {
  const parts = token.split('_');
  const last = parts[parts.length - 1] ?? token;
  return `${parts.slice(0, -1).join('_')}_${'•'.repeat(8)}${last.slice(-4)}`;
}

function CreateApiKeyDialog({ projectId }: { projectId: string }) {
  const environments = useProjectEnvironments(projectId);
  const { createApiKey } = useStore();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [envId, setEnvId] = React.useState<string>('');
  const [created, setCreated] = React.useState<ApiKey | null>(null);
  const [copied, setCopied] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !envId) return;
    const key = createApiKey({
      projectId,
      environmentId: envId,
      name: name.trim(),
    });
    setCreated(key);
    toast.success('API key created');
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setName('');
      setEnvId('');
      setCreated(null);
      setCopied(false);
    }
  }

  async function copyToken() {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button disabled={environments.length === 0}>
            <Plus data-icon="inline-start" />
            New API Key
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Copy this key now. For your security it will be masked
                afterwards.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 py-4">
              <code className="flex-1 truncate px-1 text-sm">
                {created.token}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={copyToken}
              >
                {copied ? <Check /> : <Copy />}
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            <DialogFooter>
              <DialogClose render={<Button />}>Done</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Scope this key to a single environment.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="key-name">Name</FieldLabel>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Server"
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="key-env">Environment</FieldLabel>
                <Select value={envId} onValueChange={setEnvId}>
                  <SelectTrigger id="key-env" className="w-full">
                    <SelectValue placeholder="Select an environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {environments.map((env) => (
                        <SelectItem key={env.id} value={env.id}>
                          {env.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={!name.trim() || !envId}>
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TokenCell({ token }: { token: string }) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1">
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {revealed ? token : maskToken(token)}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        onClick={() => setRevealed((r) => !r)}
      >
        {revealed ? <EyeOff /> : <Eye />}
        <span className="sr-only">{revealed ? 'Hide' : 'Reveal'} key</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
        <span className="sr-only">Copy key</span>
      </Button>
    </div>
  );
}

export function ApiKeysPanel({ projectId }: { projectId: string }) {
  const apiKeys = useProjectApiKeys(projectId);
  const environments = useProjectEnvironments(projectId);
  const { deleteApiKey } = useStore();
  const [revoking, setRevoking] = React.useState<ApiKey | null>(null);

  const envName = (id: string) =>
    environments.find((e) => e.id === id)?.name ?? '—';
  const envColor = (id: string) => environments.find((e) => e.id === id)?.color;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Keys authenticate SDKs against a specific environment.
          </p>
        </div>
        <CreateApiKeyDialog projectId={projectId} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 p-0">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <KeyRound />
                      </EmptyMedia>
                      <EmptyTitle>No API keys</EmptyTitle>
                      <EmptyDescription>
                        {environments.length === 0
                          ? 'Create an environment first, then add a key.'
                          : 'Create a key to connect your SDKs.'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1 font-normal">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: envColor(key.environmentId) }}
                      />
                      {envName(key.environmentId)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TokenCell token={key.token} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setRevoking(key)}
                    >
                      <Trash2 />
                      <span className="sr-only">Revoke key</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking ? (
                <>
                  <strong>{revoking.name}</strong> will stop working
                  immediately. Any SDK using it will lose access.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (revoking) {
                  deleteApiKey(revoking.id);
                  toast.success('API key revoked', {
                    description: revoking.name,
                  });
                }
                setRevoking(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
