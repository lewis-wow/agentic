import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home(): Promise<never> {
  const projectCount = await prisma.project.count();
  redirect(projectCount === 0 ? '/setup' : '/dashboard');
}
