import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const BCRYPT_ROUNDS = 10;

export type GenerateApiKeyPayload = {
  fullKey: string;
  apiKeyId: string;
  apiKeyHash: string;
};

/**
 * Generates a new API key in the format `env_<apiKeyId>.<secret>`.
 *
 * - `apiKeyId` (32 hex chars) is stored plaintext in the DB for indexed lookup.
 * - `secret` (64 hex chars) is bcrypt-hashed and stored as `apiKeyHash`.
 * - Only the `secret` portion is hashed (bcrypt 72-byte limit; secret is 64 bytes).
 */
export const generateApiKey = async (): Promise<GenerateApiKeyPayload> => {
  const apiKeyId = randomBytes(16).toString('hex');
  const secret = randomBytes(32).toString('hex');
  const fullKey = `env_${apiKeyId}.${secret}`;
  const apiKeyHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
  return { fullKey, apiKeyId, apiKeyHash };
};

type VerifyApiKeyArgs = {
  fullKey: string;
  apiKeyHash: string;
};

/**
 * Verifies a presented API key against its stored bcrypt hash.
 * Splits `fullKey` on `.` and compares the secret portion only.
 */
export const verifyApiKey = async (
  args: VerifyApiKeyArgs,
): Promise<boolean> => {
  const dotIndex = args.fullKey.indexOf('.');
  if (dotIndex === -1) {
    return false;
  }
  const secret = args.fullKey.slice(dotIndex + 1);
  if (!secret) {
    return false;
  }
  return bcrypt.compare(secret, args.apiKeyHash);
};
