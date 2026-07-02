import { useQuery } from '@tanstack/react-query';

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const userKeys = {
  all: () => ['users'] as const,
} as const;

export const useUsers = () =>
  useQuery({
    queryKey: userKeys.all(),
    queryFn: async (): Promise<UserListItem[]> => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { users: UserListItem[] };
      return data.users;
    },
  });
