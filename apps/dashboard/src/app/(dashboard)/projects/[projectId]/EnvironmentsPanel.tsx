'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { DataTable } from '@repo/ui/components/data-table';
import { Button } from '@repo/ui/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useRotateApiKey,
} from '../../../../queries/environments';
import { useProject, type Environment } from '../../../../queries/projects';
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

type RevealedKey = {
  fullKey: string;
  label: string;
};

export const EnvironmentsPanel = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const { data: project } = useProject(projectId);
  const environments = project?.environments ?? [];
  const createMutation = useCreateEnvironment(projectId);
  const [revealedKey, setRevealedKey] = useState<RevealedKey | null>(null);

  const columns: ColumnDef<Environment>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Environment',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-xs text-gray-400">
              ID: {row.original.apiKeyId}
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <EnvironmentActions
            environment={row.original}
            projectId={projectId}
            canManage={canManage}
            onReveal={setRevealedKey}
          />
        ),
      },
    ],
    [projectId, canManage],
  );

  const form = useForm<CreateEnvironmentFormValues>({
    resolver: effectTsResolver(CreateEnvironmentFormSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = (values: CreateEnvironmentFormValues): void => {
    createMutation.mutate(values, {
      onSuccess: (data) => {
        form.reset();
        setRevealedKey({
          fullKey: data.fullKey,
          label: 'New environment created',
        });
      },
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Environments
      </h2>

      {revealedKey && (
        <ApiKeyReveal fullKey={revealedKey.fullKey} label={revealedKey.label} />
      )}

      <DataTable
        columns={columns}
        data={environments}
        emptyMessage="No environments yet."
      />

      {canManage && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex items-start gap-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="New environment name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Add environment'}
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-red-700">
                {createMutation.error.message}
              </p>
            )}
          </form>
        </Form>
      )}
    </section>
  );
};

type EnvironmentActionsProps = {
  environment: Environment;
  projectId: string;
  canManage: boolean;
  onReveal: (payload: RevealedKey) => void;
};

const EnvironmentActions = ({
  environment,
  projectId,
  canManage,
  onReveal,
}: EnvironmentActionsProps): React.ReactNode => {
  const [showDelete, setShowDelete] = useState(false);
  const rotateMutation = useRotateApiKey(projectId);

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-gray-600"
          disabled={rotateMutation.isPending}
          onClick={() =>
            rotateMutation.mutate(environment.id, {
              onSuccess: (data) =>
                onReveal({ fullKey: data.fullKey, label: 'API key rotated' }),
            })
          }
        >
          {rotateMutation.isPending ? 'Rotating…' : 'Rotate key'}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-red-600"
          onClick={() => setShowDelete((v) => !v)}
        >
          Delete
        </Button>
      </div>

      {rotateMutation.isError && (
        <p className="text-sm text-red-700">{rotateMutation.error.message}</p>
      )}

      {showDelete && (
        <DeleteEnvironmentForm
          projectId={projectId}
          environmentId={environment.id}
          environmentName={environment.name}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
};

type DeleteEnvironmentFormProps = {
  projectId: string;
  environmentId: string;
  environmentName: string;
  onCancel: () => void;
};

const DeleteEnvironmentForm = ({
  projectId,
  environmentId,
  environmentName,
  onCancel,
}: DeleteEnvironmentFormProps): React.ReactNode => {
  const mutation = useDeleteEnvironment(projectId);

  const form = useForm<DeleteEnvironmentFormValues>({
    resolver: effectTsResolver(
      makeDeleteEnvironmentFormSchema(environmentName),
    ),
    defaultValues: { confirmation: '' },
  });

  const onSubmit = (): void => {
    mutation.mutate(environmentId, { onSuccess: onCancel });
  };

  return (
    <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-gray-600">
        Type <span className="font-mono font-semibold">{environmentName}</span>{' '}
        to confirm deletion. All flag states will be permanently removed.
      </p>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-wrap items-center gap-2"
        >
          <FormField
            control={form.control}
            name="confirmation"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder={environmentName}
                    className="text-xs"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </form>
      </Form>
      {mutation.isError && (
        <p className="text-xs text-red-700">{mutation.error.message}</p>
      )}
    </div>
  );
};

type ApiKeyRevealProps = {
  fullKey: string;
  label: string;
};

const ApiKeyReveal = ({
  fullKey,
  label,
}: ApiKeyRevealProps): React.ReactNode => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3">
      <p className="text-xs font-medium text-green-800">
        {label} — copy your API key now. It won&apos;t be shown again.
      </p>
      <div className="flex items-center gap-2">
        <pre className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-xs text-gray-800">
          {fullKey}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};
