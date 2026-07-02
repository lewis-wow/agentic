'use client';

import { MEMBERSHIP_ROLE } from '@repo/auth/roles';
import { DataTable } from '@repo/ui/components/data-table';
import { Badge } from '@repo/ui/components/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import {
  type AddableUser,
  addMemberAction,
  type MemberActionState,
  removeMemberAction,
  searchAddableUsers,
} from './actions';

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type OwnerUser = { id: string; name: string; email: string } | null;

type Props = {
  projectId: string;
  canManage: boolean;
  owner: OwnerUser;
  members: Member[];
};

type MemberRow = {
  key: string;
  memberId: string | null;
  name: string;
  email: string;
  role: string;
};

const initialState: MemberActionState = {};

export const MembersPanel = ({
  projectId,
  canManage,
  owner,
  members,
}: Props): React.ReactNode => {
  const [addState, addAction] = useActionState(addMemberAction, initialState);
  const [removeState, removeAction] = useActionState(
    removeMemberAction,
    initialState,
  );

  const rows: MemberRow[] = useMemo(
    () => [
      ...(owner
        ? [
            {
              key: `owner-${owner.id}`,
              memberId: null,
              name: owner.name,
              email: owner.email,
              role: 'owner',
            },
          ]
        : []),
      ...members.map((member) => ({
        key: member.id,
        memberId: member.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
    ],
    [owner, members],
  );

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
            <form action={removeAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="hidden"
                name="memberId"
                value={row.original.memberId}
              />
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </form>
          ) : null,
      },
    ],
    [canManage, projectId, removeAction],
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

      {removeState.error && (
        <p className="text-sm text-red-700">{removeState.error}</p>
      )}

      {canManage && (
        <AddMemberForm
          projectId={projectId}
          action={addAction}
          error={addState.error}
        />
      )}
    </section>
  );
};

type AddMemberFormProps = {
  projectId: string;
  action: (payload: FormData) => void;
  error?: string;
};

const AddMemberForm = ({
  projectId,
  action,
  error,
}: AddMemberFormProps): React.ReactNode => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddableUser[]>([]);
  const [selected, setSelected] = useState<AddableUser | null>(null);
  const [isSearching, startSearch] = useTransition();

  useEffect(() => {
    if (selected) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const handle = setTimeout(() => {
      startSearch(async () => {
        const found = await searchAddableUsers(projectId, trimmed);
        setResults(found);
      });
    }, 250);

    return () => clearTimeout(handle);
  }, [query, projectId, selected]);

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <h3 className="text-sm font-medium">Add a member</h3>

      {selected ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="userId" value={selected.id} />
          <span className="text-sm">
            {selected.name}{' '}
            <span className="text-gray-500">&lt;{selected.email}&gt;</span>
          </span>
          <select
            name="role"
            defaultValue={MEMBERSHIP_ROLE.VIEWER}
            className="rounded-md border px-2 py-1 text-sm"
          >
            <option value={MEMBERSHIP_ROLE.VIEWER}>viewer</option>
            <option value={MEMBERSHIP_ROLE.ADMIN}>admin</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery('');
            }}
            className="text-sm text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
          {isSearching && <p className="text-xs text-gray-400">Searching…</p>}
          {results.length > 0 && (
            <ul className="divide-y rounded-md border">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(user)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{user.name}</span>
                    <span className="text-gray-500">{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isSearching && query.trim() && results.length === 0 && (
            <p className="text-xs text-gray-400">No matching users.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
};
