import { redirect } from 'next/navigation';

import { type MemberRole, MEMBER_ROLE } from './auth.js';
import { getSession } from './session.js';

const ROLE_RANK: Record<MemberRole, number> = {
  [MEMBER_ROLE.VIEWER]: 0,
  [MEMBER_ROLE.ADMIN]: 1,
  [MEMBER_ROLE.OWNER]: 2,
};

export const requireRole = async (
  minimum: MemberRole,
): Promise<{
  userId: string;
  role: MemberRole;
  email: string;
}> => {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const role = (session.user.role as MemberRole) ?? MEMBER_ROLE.VIEWER;

  if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
    redirect('/dashboard');
  }

  return { userId: session.user.id, role, email: session.user.email };
};
