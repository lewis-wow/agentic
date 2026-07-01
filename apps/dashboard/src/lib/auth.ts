import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { env } from '../env';

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  // The devcontainer's forwarded port is only reachable via 127.0.0.1 on some
  // hosts (localhost resolves to ::1 first with no IPv6 forwarder listening),
  // so trust both loopback forms in development.
  trustedOrigins:
    process.env.NODE_ENV === 'production'
      ? [env.NEXT_PUBLIC_APP_URL]
      : [env.NEXT_PUBLIC_APP_URL, 'http://127.0.0.1:3000'],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // System-level role. Never trusted from client input — the setup wizard
      // promotes the first user to OWNER server-side; everyone else stays MEMBER.
      role: {
        type: 'string',
        required: false,
        defaultValue: SYSTEM_ROLE.MEMBER,
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
