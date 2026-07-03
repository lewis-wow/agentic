import { SYSTEM_ROLE, type SystemRole } from '@repo/auth/roles';
import type { User } from '@repo/prisma';
import { timingSafeEqual } from 'node:crypto';

export type ResolveTrustedProxyUserArgs = {
  secret: string | undefined;
  email: string | undefined;
  expectedSecret: string;
  designatedOwnerEmail: string;
  upsertUser: (args: { email: string; role: SystemRole }) => Promise<User>;
};

const secretsMatch = (secret: string, expectedSecret: string): boolean => {
  const secretBuffer = Buffer.from(secret);
  const expectedBuffer = Buffer.from(expectedSecret);

  return (
    secretBuffer.length === expectedBuffer.length &&
    timingSafeEqual(secretBuffer, expectedBuffer)
  );
};

export const resolveTrustedProxyUser = async (
  args: ResolveTrustedProxyUserArgs,
): Promise<User | null> => {
  if (!args.secret || !secretsMatch(args.secret, args.expectedSecret)) {
    return null;
  }
  if (!args.email) return null;

  const role =
    args.email === args.designatedOwnerEmail
      ? SYSTEM_ROLE.OWNER
      : SYSTEM_ROLE.MEMBER;

  return args.upsertUser({ email: args.email, role });
};
