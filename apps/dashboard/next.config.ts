import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@repo/ui',
    '@repo/utils',
    '@repo/prisma',
    '@repo/pagination',
    '@prisma/client',
    'effect',
  ],
  devIndicators: false,
  experimental: {
    // Enables forbidden() / unauthorized() interrupts used by the route guards.
    authInterrupts: true,
  },
  // `next build` still runs on webpack, so this stays for barrel files
  // (e.g. `./flags.js` re-exports) that only have a `.ts`/`.tsx` source.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
  // Turbopack (used by `next dev`) resolves `.js` specifiers to `.ts`/`.tsx`
  // sources natively, but this key must be present so Next.js knows Turbopack
  // has been configured and stops warning about the webpack config above.
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
};

export default nextConfig;
