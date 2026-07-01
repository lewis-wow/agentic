import { headers } from 'next/headers';

import { auth } from './auth';

export const getSession = async (): Promise<
  typeof auth.$Infer.Session | null
> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
};
