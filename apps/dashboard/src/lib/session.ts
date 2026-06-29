import { headers } from 'next/headers';

import { auth } from './auth.js';

export const getSession = async (): Promise<
  typeof auth.$Infer.Session | null
> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
};
