'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { DataTable } from '@repo/ui/components/data-table';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { FlagStatusBadge } from '../../../../../components/FlagStatusBadge';
import {
  useFlagDetail,
  useRenameFlag,
  useToggleFlag,
  useUpdateFlagEnvironment,
  useUpdateFlagRules,
  type FlagState,
  type FlagType,
  type TargetingRule,
} from '../../../../../queries/flags';
import {
  RenameFlagFormSchema,
  RulesFormSchema,
  type RenameFlagFormValues,
  type RuleFormValues,
  type RulesFormValues,
} from '../../../../../schemas/flags';

type Props = {
  projectId: string;
  flagId: string;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const EditFlagDialog = ({
  projectId,
  flagId,
  canManage,
  open,
  onOpenChange,
}: Props): React.ReactNode => {
  const { data: flag, isPending, error } = useFlagDetail(projectId, flagId);
  const isArchived = flag?.states.every((s) => s.status === 'archived');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{flag ? flag.name : 'Edit flag'}</DialogTitle>
          <DialogDescription>
            {flag ? (
              <span className="font-mono text-xs">{flag.key}</span>
            ) : (
              'Rename this flag and manage its rollout per environment.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isPending && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-700">{error.message}</p>}

        {flag && (
          <div className="space-y-6">
            {canManage && (
              <RenameSection
                projectId={projectId}
                flagId={flagId}
                currentName={flag.name}
              />
            )}

            <StatesSection
              projectId={projectId}
              flagId={flagId}
              states={flag.states}
              canManage={canManage}
              isArchived={isArchived ?? false}
            />

            {canManage &&
              flag.states
                .filter((s) => s.type === 'targeted' && s.status !== 'archived')
                .map((s) => (
                  <RuleBuilderSection
                    key={s.environmentId}
                    projectId={projectId}
                    flagId={flagId}
                    state={s}
                  />
                ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

type RenameSectionProps = {
  projectId: string;
  flagId: string;
  currentName: string;
};
const RenameSection = ({
  projectId,
  flagId,
  currentName,
}: RenameSectionProps): React.ReactNode => {
  const mutation = useRenameFlag(projectId, flagId);

  const form = useForm<RenameFlagFormValues>({
    resolver: effectTsResolver(RenameFlagFormSchema),
    defaultValues: { name: currentName },
  });

  const nameValue = form.watch('name');

  const onSubmit = (values: RenameFlagFormValues): void => {
    if (values.name === currentName) return;
    mutation.mutate(values);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Rename
      </h3>
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={mutation.isPending || nameValue === currentName}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Form>
      {mutation.isError && (
        <p className="text-sm text-red-700">{mutation.error.message}</p>
      )}
    </section>
  );
};

type StatesSectionProps = {
  projectId: string;
  flagId: string;
  states: FlagState[];
  canManage: boolean;
  isArchived: boolean;
};
const StatesSection = ({
  projectId,
  flagId,
  states,
  canManage,
  isArchived,
}: StatesSectionProps): React.ReactNode => {
  const toggleMutation = useToggleFlag(projectId);
  const updateMutation = useUpdateFlagEnvironment(projectId);

  const handleToggle = (state: FlagState): void => {
    const next = state.status === 'active' ? 'inactive' : 'active';
    toggleMutation.mutate({
      flagId,
      environmentId: state.environmentId,
      status: next,
    });
  };

  const handleTypeChange = (state: FlagState, newType: FlagType): void => {
    updateMutation.mutate({
      flagId,
      environmentId: state.environmentId,
      type: newType,
    });
  };

  const handleRolloutBlur = (state: FlagState, value: number): void => {
    if (value === state.rollout) return;
    updateMutation.mutate({
      flagId,
      environmentId: state.environmentId,
      rollout: value,
    });
  };

  const isUpdating = (environmentId: string): boolean =>
    (updateMutation.isPending &&
      updateMutation.variables?.environmentId === environmentId) ||
    (toggleMutation.isPending &&
      toggleMutation.variables?.environmentId === environmentId);

  const columns: ColumnDef<FlagState>[] = [
    {
      accessorKey: 'environmentName',
      header: 'Environment',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.environmentName}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <FlagStatusBadge status={row.original.status} />,
    },
    {
      id: 'toggle',
      header: 'Toggle',
      cell: ({ row }) => {
        const state = row.original;
        const disabled =
          !canManage || isArchived || isUpdating(state.environmentId);
        return (
          <button
            type="button"
            onClick={() => handleToggle(state)}
            disabled={disabled}
            aria-label={
              state.status === 'active'
                ? 'Deactivate in this environment'
                : 'Activate in this environment'
            }
            className={[
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-40',
              state.status === 'active' ? 'bg-black' : 'bg-gray-200',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
                state.status === 'active' ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        );
      },
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const state = row.original;
        const disabled =
          !canManage || isArchived || isUpdating(state.environmentId);
        return (
          <select
            value={state.type}
            onChange={(e) =>
              handleTypeChange(state, e.target.value as FlagType)
            }
            disabled={disabled}
            className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <option value="boolean">Boolean</option>
            <option value="percentage_rollout">Rollout %</option>
            <option value="targeted">Targeted</option>
          </select>
        );
      },
    },
    {
      id: 'rollout',
      header: 'Rollout %',
      cell: ({ row }) => {
        const state = row.original;
        if (state.type !== 'percentage_rollout') return null;
        const disabled =
          !canManage || isArchived || isUpdating(state.environmentId);
        return (
          <RolloutInput
            rollout={state.rollout}
            disabled={disabled}
            onCommit={(value) => handleRolloutBlur(state, value)}
          />
        );
      },
    },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Environments
      </h3>
      <DataTable columns={columns} data={states} />
      {toggleMutation.isError && (
        <p className="text-sm text-red-700">{toggleMutation.error.message}</p>
      )}
      {updateMutation.isError && (
        <p className="text-sm text-red-700">{updateMutation.error.message}</p>
      )}
    </section>
  );
};

type RolloutInputProps = {
  rollout: number;
  disabled: boolean;
  onCommit: (value: number) => void;
};

const RolloutInput = ({
  rollout,
  disabled,
  onCommit,
}: RolloutInputProps): React.ReactNode => {
  const [value, setValue] = useState(rollout);

  return (
    <input
      type="number"
      min={0}
      max={100}
      value={value}
      onChange={(e) => setValue(Number(e.target.value))}
      onBlur={() => onCommit(value)}
      disabled={disabled}
      className="w-20 rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
};

type RuleBuilderSectionProps = {
  projectId: string;
  flagId: string;
  state: FlagState;
};

const toDraftRule = (rule: TargetingRule): RuleFormValues => ({
  attribute: rule.attribute,
  operator: rule.operator,
  valueRaw: rule.value.join(', '),
});

const toTargetingRule = (draft: RuleFormValues): TargetingRule => ({
  attribute: draft.attribute,
  operator: draft.operator,
  value: draft.valueRaw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0),
});

const BLANK_RULE: RuleFormValues = {
  attribute: '',
  operator: 'EQ',
  valueRaw: '',
};

const RuleBuilderSection = ({
  projectId,
  flagId,
  state,
}: RuleBuilderSectionProps): React.ReactNode => {
  const mutation = useUpdateFlagRules(projectId);

  const form = useForm<RulesFormValues>({
    resolver: effectTsResolver(RulesFormSchema),
    defaultValues: { rules: state.rules.map(toDraftRule) },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  const onSubmit = (values: RulesFormValues): void => {
    mutation.mutate({
      flagId,
      environmentId: state.environmentId,
      rules: values.rules.map(toTargetingRule),
    });
  };

  const busy = mutation.isPending;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Rules — {state.environmentName}
      </h3>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-gray-400">
              No rules yet. Add one below.
            </p>
          )}

          <div className="space-y-2">
            {fields.map((item, i) => {
              const operator = form.watch(`rules.${i}.operator`);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <FormField
                    control={form.control}
                    name={`rules.${i}.attribute`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormControl>
                          <Input
                            placeholder="attribute"
                            disabled={busy}
                            className="text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`rules.${i}.operator`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <select
                            value={field.value}
                            onChange={field.onChange}
                            disabled={busy}
                            className="rounded border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black disabled:opacity-40"
                          >
                            <option value="EQ">EQ</option>
                            <option value="NEQ">NEQ</option>
                            <option value="IN">IN</option>
                            <option value="NOT_IN">NOT_IN</option>
                            <option value="CONTAINS">CONTAINS</option>
                          </select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`rules.${i}.valueRaw`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder={
                              operator === 'IN' || operator === 'NOT_IN'
                                ? 'value1, value2'
                                : 'value'
                            }
                            disabled={busy}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => move(i, i - 1)}
                    disabled={busy || i === 0}
                    aria-label="Move rule up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => move(i, i + 1)}
                    disabled={busy || i === fields.length - 1}
                    aria-label="Move rule down"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(i)}
                    disabled={busy}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...BLANK_RULE })}
              disabled={busy}
            >
              Add rule
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save rules'}
            </Button>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-700">{mutation.error.message}</p>
          )}
        </form>
      </Form>
    </section>
  );
};
