'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { MEMBERSHIP_ROLE } from '@repo/auth/roles';
import { TablePagination } from '@repo/ui/components/TablePagination';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
import { Plus, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { PersonTableSkeleton } from '../../../../components/PersonTableSkeleton';
import {
  useAddableUsers,
  useAddMember,
  useMembers,
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

const initials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const MembersPanel = ({
  projectId,
  canManage,
}: Props): React.ReactNode => {
  const { data: project } = useProject(projectId);
  const removeMutation = useRemoveMember(projectId);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const {
    data: members,
    isPending,
    page,
    setPage,
    totalPages,
    total,
  } = useMembers(projectId, debouncedQuery);

  const rows = [
    ...(project?.owner && !debouncedQuery
      ? [
          {
            key: `owner-${project.owner.id}`,
            memberId: null as string | null,
            name: project.owner.name,
            email: project.owner.email,
            role: 'owner',
          },
        ]
      : []),
    ...(members ?? []).map((member) => ({
      key: member.id,
      memberId: member.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Members</h2>
          <p className="text-sm text-muted-foreground">
            People with access to this project.
          </p>
        </div>
        {canManage && <AddMemberDialog projectId={projectId} />}
      </div>

      <div className="relative w-full max-w-sm">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Search members"
        />
      </div>

      {isPending ? (
        <PersonTableSkeleton rows={2} showActions />
      ) : rows.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>
              {debouncedQuery ? 'No members found' : 'No members yet'}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedQuery
                ? 'No members match your search.'
                : 'Add a member to give them access to this project.'}
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
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback>
                              {initials(row.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{row.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {row.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && row.memberId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(row.memberId!)}
                          >
                            <Trash2 />
                            <span className="sr-only">Remove member</span>
                          </Button>
                        )}
                      </TableCell>
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

      {removeMutation.isError && (
        <p className="text-sm text-red-700">{removeMutation.error.message}</p>
      )}
    </div>
  );
};

type AddMemberDialogProps = {
  projectId: string;
};

const AddMemberDialog = ({
  projectId,
}: AddMemberDialogProps): React.ReactNode => {
  const [open, setOpen] = useState(false);
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

  const reset = (): void => {
    setSelected(null);
    setQuery('');
    setDebouncedQuery('');
    form.reset({ userId: '', role: MEMBERSHIP_ROLE.VIEWER });
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    setOpen(next);
  };

  const handleSelect = (user: AddableUser): void => {
    setSelected(user);
    form.setValue('userId', user.id);
  };

  const onSubmit = (values: AddMemberFormValues): void => {
    mutation.mutate(values, { onSuccess: () => handleOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>
            Search for a user to give them access to this project.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {selected ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-wrap items-center gap-3"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(selected.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">
                    {selected.name}{' '}
                    <span className="text-muted-foreground">
                      &lt;{selected.email}&gt;
                    </span>
                  </span>
                </div>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger size="sm" className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={MEMBERSHIP_ROLE.VIEWER}>
                              viewer
                            </SelectItem>
                            <SelectItem value={MEMBERSHIP_ROLE.ADMIN}>
                              admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Adding…' : 'Add'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  Cancel
                </Button>
              </form>
            </Form>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                autoFocus
              />
              {isSearching && (
                <ul className="divide-y rounded-md border">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </li>
                  ))}
                </ul>
              )}
              {!isSearching && results.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {results.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(user)}
                        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span>{user.name}</span>
                        <span className="text-muted-foreground">
                          {user.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!isSearching &&
                debouncedQuery.trim() &&
                results.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No matching users.
                  </p>
                )}
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-red-700">{mutation.error.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
