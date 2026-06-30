import { createHash } from 'node:crypto';

export const bucket = (flagKey: string, userId: string): number => {
  const hash = createHash('sha256').update(`${flagKey}/${userId}`).digest();
  const uint32 = hash.readUInt32BE(0);
  return uint32 % 100;
};
