'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { slugifyEnvironmentName } from '@repo/auth/key-prefix';
import { DisabledButtonTooltip } from '@repo/ui/components/DisabledButtonTooltip';
import { TablePagination } from '@repo/ui/components/TablePagination';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/ui/alert-dialog';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import {
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiKeyReveal } from '../../../../components/ApiKeyReveal';
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useRevokeApiKey,
  useRotateApiKey,
  type ApiKeyListItem,
} from '../../../../queries/apiKeys';
import { useProject } from '../../../../queries/projects';
import {
  CreateApiKeyFormSchema,
  makeDeleteApiKeyFormSchema,
  type CreateApiKeyFormValues,
  type DeleteApiKeyFormValues,
} from '../../../../schemas/apiKeys';

type Props = {
  projectId: string;
  canManage: boolean;
};

export const ApiKeysPanel = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyListItem | null>(null);
  const [deleting, setDeleting] = useState<ApiKeyListItem | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const {
    data: apiKeys,
    isPending,
    page,
    setPage,
    totalPages,
    total,
  } = useApiKeys(projectId, debouncedQuery);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Keys authenticate SDKs against a specific environment. Full keys are
            shown once, at creation or rotation.
          </p>
        </div>
        {canManage && (
          <CreateApiKeyDialog
            projectId={projectId}
            onCreated={setRevealedKey}
          />
        )}
      </div>

      {revealedKey && (
        <ApiKeyReveal fullKey={revealedKey} label="Copy your new API key" />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search API keys..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search API keys"
          />
        </div>
      </div>

      {isPending ? (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-12 text-right" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                <ApiKeyRowSkeleton canManage={canManage} />
                <ApiKeyRowSkeleton canManage={canManage} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !apiKeys || apiKeys.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>
              {debouncedQuery ? 'No API keys found' : 'No API keys'}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedQuery
                ? 'No API keys match your search.'
                : 'Create an API key to authenticate SDK clients.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-12 text-right" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <ApiKeyRow
                      key={key.id}
                      projectId={projectId}
                      apiKey={key}
                      canManage={canManage}
                      onRotated={setRevealedKey}
                      onRevoke={setRevoking}
                      onDelete={setDeleting}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {revoking && (
        <RevokeApiKeyDialog
          projectId={projectId}
          apiKey={revoking}
          open={!!revoking}
          onOpenChange={(open) => !open && setRevoking(null)}
        />
      )}
      {deleting && (
        <DeleteApiKeyDialog
          projectId={projectId}
          apiKey={deleting}
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
    </div>
  );
};

const ApiKeyRowSkeleton = ({
  canManage,
}: {
  canManage: boolean;
}): React.ReactNode => (
  <TableRow>
    <TableCell>
      <Skeleton className="h-4 w-24" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-20 rounded-full" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-40" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-16 rounded-full" />
    </TableCell>
    {canManage && (
      <TableCell className="text-right">
        <Skeleton className="ml-auto size-8 rounded-md" />
      </TableCell>
    )}
  </TableRow>
);

type CreateApiKeyDialogProps = {
  projectId: string;
  onCreated: (fullKey: string) => void;
};

const CreateApiKeyDialog = ({
  projectId,
  onCreated,
}: CreateApiKeyDialogProps): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const { data: project } = useProject(projectId);
  const environments = project?.environments ?? [];
  const createMutation = useCreateApiKey(projectId);
  const disabled = environments.length === 0;

  const form = useForm<CreateApiKeyFormValues>({
    resolver: effectTsResolver(CreateApiKeyFormSchema),
    defaultValues: { name: '', environmentId: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    setOpen(next);
  };

  const onSubmit = (values: CreateApiKeyFormValues): void => {
    createMutation.mutate(values, {
      onSuccess: (data) => {
        handleOpenChange(false);
        onCreated(data.fullKey);
      },
    });
  };

  const buttonContent = (
    <>
      <Plus />
      New API key
    </>
  );

  if (disabled) {
    return (
      <DisabledButtonTooltip reason="Create an environment first.">
        <Button
          size="sm"
          tabIndex={-1}
          aria-disabled="true"
          className="pointer-events-none opacity-50"
        >
          {buttonContent}
        </Button>
      </DisabledButtonTooltip>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">{buttonContent}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                The full key is shown once after creation — copy it immediately.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id="api-key-name"
                          placeholder="e.g. Production Server"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="api-key-environment">
                  Environment
                </FieldLabel>
                <FormField
                  control={form.control}
                  name="environmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="api-key-environment">
                            <SelectValue placeholder="Select an environment" />
                          </SelectTrigger>
                          <SelectContent>
                            {environments.map((env) => (
                              <SelectItem key={env.id} value={env.id}>
                                {env.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
            {createMutation.isError && (
              <p className="mt-2 text-sm text-red-700">
                {createMutation.error.message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

type ApiKeyRowProps = {
  projectId: string;
  apiKey: ApiKeyListItem;
  canManage: boolean;
  onRotated: (fullKey: string) => void;
  onRevoke: (apiKey: ApiKeyListItem) => void;
  onDelete: (apiKey: ApiKeyListItem) => void;
};

const ApiKeyRow = ({
  projectId,
  apiKey,
  canManage,
  onRotated,
  onRevoke,
  onDelete,
}: ApiKeyRowProps): React.ReactNode => {
  const rotateMutation = useRotateApiKey(projectId);
  const isRevoked = !!apiKey.revokedAt;
  const envSlug = slugifyEnvironmentName(apiKey.environmentName);

  return (
    <TableRow>
      <TableCell className="font-medium">{apiKey.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{apiKey.environmentName}</Badge>
      </TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {envSlug ? `${envSlug}_` : ''}
          {apiKey.apiKeyId}.••••••••
        </code>
      </TableCell>
      <TableCell>
        <Badge variant={isRevoked ? 'outline' : 'default'}>
          {isRevoked ? 'Revoked' : 'Active'}
        </Badge>
      </TableCell>
      {canManage && (
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal />
                <span className="sr-only">API key actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={isRevoked || rotateMutation.isPending}
                  onClick={() =>
                    rotateMutation.mutate(apiKey.id, {
                      onSuccess: (data) => onRotated(data.fullKey),
                    })
                  }
                >
                  <RefreshCw />
                  Rotate
                </DropdownMenuItem>
                {!isRevoked && (
                  <DropdownMenuItem onClick={() => onRevoke(apiKey)}>
                    <ShieldOff />
                    Revoke
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(apiKey)}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
};

type RevokeApiKeyDialogProps = {
  projectId: string;
  apiKey: ApiKeyListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const RevokeApiKeyDialog = ({
  projectId,
  apiKey,
  open,
  onOpenChange,
}: RevokeApiKeyDialogProps): React.ReactNode => {
  const mutation = useRevokeApiKey(projectId);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{apiKey.name}</strong> will immediately stop authenticating
            SDK clients. This cannot be undone — create a new key if you need
            one later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p className="text-sm text-red-700">{mutation.error.message}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(apiKey.id, {
                onSuccess: () => onOpenChange(false),
              })
            }
          >
            {mutation.isPending ? 'Revoking…' : 'Revoke'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type DeleteApiKeyDialogProps = {
  projectId: string;
  apiKey: ApiKeyListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DeleteApiKeyDialog = ({
  projectId,
  apiKey,
  open,
  onOpenChange,
}: DeleteApiKeyDialogProps): React.ReactNode => {
  const mutation = useDeleteApiKey(projectId);

  const form = useForm<DeleteApiKeyFormValues>({
    resolver: effectTsResolver(makeDeleteApiKeyFormSchema(apiKey.name)),
    defaultValues: { confirmation: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    onOpenChange(next);
  };

  const onSubmit = (): void => {
    mutation.mutate(apiKey.id, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this API key?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{apiKey.name}</strong> will be permanently removed. Type{' '}
                <span className="font-mono font-semibold text-foreground">
                  {apiKey.name}
                </span>{' '}
                to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <FormField
                control={form.control}
                name="confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder={apiKey.name} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-700">{mutation.error.message}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
