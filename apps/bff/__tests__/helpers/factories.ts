import type { Environment, User } from '@repo/prisma';
import { generateKeyPairSync } from 'node:crypto';

import type { ApiKeyLookupResult } from '../../src/auth/middleware.js';

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
