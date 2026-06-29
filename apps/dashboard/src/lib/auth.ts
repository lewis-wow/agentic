import { prisma } from '@repo/prisma';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { env } from '../env.js';

export const MEMBER_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  VIEWER: 'viewer',
} as const;

export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: MEMBER_ROLE.VIEWER,
        input: true,
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
