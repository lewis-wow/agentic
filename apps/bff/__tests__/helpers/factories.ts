import type { Environment, ProjectMember, Session, User } from '@repo/prisma';
import { generateKeyPairSync } from 'node:crypto';

import type {
  ApiKeyLookupResult,
  SessionWithUser,
} from '../../src/auth/middleware.js';

export const generateTestKeys = (): {
  privateKey: string;
  publicKey: string;
} => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
};

export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  role: 'MEMBER',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeSession = (
  overrides: Partial<SessionWithUser> = {},
): SessionWithUser => {
  const user = overrides.user ?? makeUser();
  const base: Session = {
    id: 'session-1',
    token: 'token-123',
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
    userId: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides, user };
};

export const makeMembership = (
  overrides: Partial<ProjectMember> = {},
): ProjectMember => ({
  id: 'member-1',
  userId: 'user-1',
  projectId: 'project-1',
  role: 'viewer',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeEnvironment = (
  overrides: Partial<Environment> = {},
): Environment => ({
  id: 'env-1',
  name: 'development',
  projectId: 'project-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeApiKey = (
  overrides: Partial<ApiKeyLookupResult> = {},
): ApiKeyLookupResult => ({
  apiKeyHash: '$2a$10$placeholder',
  revokedAt: null,
  environmentId: 'env-1',
  environment: { projectId: 'project-1' },
  ...overrides,
});
