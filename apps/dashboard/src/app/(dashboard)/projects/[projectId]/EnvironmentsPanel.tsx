'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
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
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { Layers, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useEnvironmentsList,
} from '../../../../queries/environments';
import type { Environment } from '../../../../queries/projects';
import {
  CreateEnvironmentFormSchema,
  makeDeleteEnvironmentFormSchema,
  type CreateEnvironmentFormValues,
  type DeleteEnvironmentFormValues,
} from '../../../../schemas/environments';

type Props = {
  projectId: string;
  canManage: boolean;
};

const EnvironmentRowSkeleton = ({
  canManage,
}: {
  canManage: boolean;
}): React.ReactNode => (
  <TableRow>
    <TableCell>
      <Skeleton className="h-4 w-24" />
    </TableCell>
    {canManage && (
      <TableCell className="text-right">
        <Skeleton className="ml-auto size-8 rounded-md" />
      </TableCell>
    )}
  </TableRow>
);

export const EnvironmentsPanel = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const [deleting, setDeleting] = useState<Environment | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const {
    data: environments,
    isPending,
    page,
    setPage,
    totalPages,
    total,
  } = useEnvironmentsList(projectId, debouncedQuery);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Environments</h2>
          <p className="text-sm text-muted-foreground">
            Each environment maintains its own flag states and API keys.
          </p>
        </div>
        {canManage && <CreateEnvironmentDialog projectId={projectId} />}
      </div>

      <div className="relative w-full max-w-sm">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search environments..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Search environments"
        />
      </div>

      {isPending ? (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {canManage && <TableHead className="w-12 text-right" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                <EnvironmentRowSkeleton canManage={canManage} />
                <EnvironmentRowSkeleton canManage={canManage} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !environments || environments.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>
              {debouncedQuery ? 'No environments found' : 'No environments'}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedQuery
                ? 'No environments match your search.'
                : 'Add an environment to start rolling out flags.'}
            </EmptyDescription>
          </EmptyHeader>
          {canManage && !debouncedQuery && (
            <CreateEnvironmentDialog projectId={projectId} />
          )}
        </Empty>
      ) : (
        <>
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {canManage && <TableHead className="w-12 text-right" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {environments.map((env) => (
                    <TableRow key={env.id}>
                      <TableCell className="font-medium">{env.name}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleting(env)}
                          >
                            <Trash2 />
                            <span className="sr-only">Delete environment</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
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

      {deleting && (
        <DeleteEnvironmentDialog
          projectId={projectId}
          environment={deleting}
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
    </div>
  );
};

type CreateEnvironmentDialogProps = {
  projectId: string;
};

const CreateEnvironmentDialog = ({
  projectId,
}: CreateEnvironmentDialogProps): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateEnvironment(projectId);

  const form = useForm<CreateEnvironmentFormValues>({
    resolver: effectTsResolver(CreateEnvironmentFormSchema),
    defaultValues: { name: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    setOpen(next);
  };

  const onSubmit = (values: CreateEnvironmentFormValues): void => {
    createMutation.mutate(values, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New environment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create environment</DialogTitle>
              <DialogDescription>
                Existing flags will be added to this environment, disabled by
                default.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="env-name">Name</FieldLabel>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id="env-name"
                          placeholder="e.g. Staging"
                          autoFocus
                          {...field}
                        />
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

type DeleteEnvironmentDialogProps = {
  projectId: string;
  environment: Environment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DeleteEnvironmentDialog = ({
  projectId,
  environment,
  open,
  onOpenChange,
}: DeleteEnvironmentDialogProps): React.ReactNode => {
  const mutation = useDeleteEnvironment(projectId);

  const form = useForm<DeleteEnvironmentFormValues>({
    resolver: effectTsResolver(
      makeDeleteEnvironmentFormSchema(environment.name),
    ),
    defaultValues: { confirmation: '' },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) form.reset();
    onOpenChange(next);
  };

  const onSubmit = (): void => {
    mutation.mutate(environment.id, {
      onSuccess: () => handleOpenChange(false),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete environment?</AlertDialogTitle>
              <AlertDialogDescription>
                Deleting <strong>{environment.name}</strong> removes its flag
                states and API keys. Type{' '}
                <span className="font-mono font-semibold text-foreground">
                  {environment.name}
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
                      <Input placeholder={environment.name} {...field} />
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
