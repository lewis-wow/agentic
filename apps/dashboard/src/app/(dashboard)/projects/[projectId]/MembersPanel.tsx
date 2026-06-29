'use client';

import { MEMBERSHIP_ROLE } from '@repo/auth/roles';
import { useActionState, useEffect, useState, useTransition } from 'react';

import {
  type AddableUser,
  addMemberAction,
  type MemberActionState,
  removeMemberAction,
  searchAddableUsers,
} from './actions.js';

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

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Members
      </h2>

      <ul className="space-y-2">
        {owner && (
          <li className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
            <span>
              {owner.name}{' '}
              <span className="text-gray-500">&lt;{owner.email}&gt;</span>
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              owner
            </span>
          </li>
        )}

        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded-md border px-4 py-3 text-sm"
          >
            <span>
              {member.user.name}{' '}
              <span className="text-gray-500">&lt;{member.user.email}&gt;</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {member.role}
              </span>
              {canManage && (
                <form action={removeAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </form>
              )}
            </span>
          </li>
        ))}

        {members.length === 0 && (
          <li className="text-sm text-gray-500">No additional members yet.</li>
        )}
      </ul>

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
