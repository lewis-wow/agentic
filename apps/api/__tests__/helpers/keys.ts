import { generateKeyPairSync } from 'node:crypto';

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
