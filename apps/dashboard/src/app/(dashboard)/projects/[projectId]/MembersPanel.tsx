'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { MEMBERSHIP_ROLE } from '@repo/auth/roles';
import { DataTable } from '@repo/ui/components/data-table';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useAddableUsers,
  useAddMember,
  useRemoveMember,
  type AddableUser,
} from '../../../../queries/members';
import { useProject } from '../../../../queries/projects';
import {
  AddMemberFormSchema,
  type AddMemberFormValues,
} from '../../../../schemas/members';

type Props = {
  projectId: string;
  canManage: boolean;
};

type MemberRow = {
  key: string;
  memberId: string | null;
  name: string;
  email: string;
  role: string;
};

export const MembersPanel = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const { data: project } = useProject(projectId);
  const removeMutation = useRemoveMember(projectId);

  const rows: MemberRow[] = useMemo(() => {
    if (!project) return [];
    return [
      ...(project.owner
        ? [
            {
              key: `owner-${project.owner.id}`,
              memberId: null,
              name: project.owner.name,
              email: project.owner.email,
              role: 'owner',
            },
          ]
        : []),
      ...project.members.map((member) => ({
        key: member.id,
        memberId: member.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
    ];
  }, [project]);

  const columns: ColumnDef<MemberRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Member',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-gray-500">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.role}</Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canManage && row.original.memberId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate(row.original.memberId!)}
            >
              Remove
            </Button>
          ) : null,
      },
    ],
    [canManage, removeMutation],
  );

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Members
      </h2>

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No additional members yet."
      />

      {removeMutation.isError && (
        <p className="text-sm text-red-700">{removeMutation.error.message}</p>
      )}

      {canManage && <AddMemberForm projectId={projectId} />}
    </section>
  );
};

type AddMemberFormProps = {
  projectId: string;
};

const AddMemberForm = ({ projectId }: AddMemberFormProps): React.ReactNode => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<AddableUser | null>(null);
  const mutation = useAddMember(projectId);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const { data: results = [], isFetching: isSearching } = useAddableUsers(
    projectId,
    debouncedQuery,
    !selected,
  );

  const form = useForm<AddMemberFormValues>({
    resolver: effectTsResolver(AddMemberFormSchema),
    defaultValues: { userId: '', role: MEMBERSHIP_ROLE.VIEWER },
  });

  const handleCancel = (): void => {
    setSelected(null);
    setQuery('');
    setDebouncedQuery('');
    form.reset({ userId: '', role: MEMBERSHIP_ROLE.VIEWER });
  };

  const handleSelect = (user: AddableUser): void => {
    setSelected(user);
    form.setValue('userId', user.id);
  };

  const onSubmit = (values: AddMemberFormValues): void => {
    mutation.mutate(values, { onSuccess: handleCancel });
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <h3 className="text-sm font-medium">Add a member</h3>

      {selected ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm">
              {selected.name}{' '}
              <span className="text-gray-500">&lt;{selected.email}&gt;</span>
            </span>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <select
                      value={field.value}
                      onChange={field.onChange}
                      className="rounded-md border px-2 py-1 text-sm"
                    >
                      <option value={MEMBERSHIP_ROLE.VIEWER}>viewer</option>
                      <option value={MEMBERSHIP_ROLE.ADMIN}>admin</option>
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </form>
        </Form>
      ) : (
        <div className="space-y-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
          />
          {isSearching && <p className="text-xs text-gray-400">Searching…</p>}
          {results.length > 0 && (
            <ul className="divide-y rounded-md border">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{user.name}</span>
                    <span className="text-gray-500">{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isSearching && debouncedQuery.trim() && results.length === 0 && (
            <p className="text-xs text-gray-400">No matching users.</p>
          )}
        </div>
      )}

      {mutation.isError && (
        <p className="text-sm text-red-700">{mutation.error.message}</p>
      )}
    </div>
  );
};
