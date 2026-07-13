import { redirect } from 'next/navigation';

import { projectsExist } from '../lib/guards';

export const dynamic = 'force-dynamic';

export default async function Home(): Promise<never> {
  const exists = await projectsExist();
  redirect(exists ? '/dashboard' : '/setup');
}
