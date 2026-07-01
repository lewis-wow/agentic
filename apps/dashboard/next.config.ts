import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@repo/ui',
    '@repo/utils',
    '@repo/prisma',
    '@prisma/client',
    'effect',
  ],
  devIndicators: false,
  experimental: {
    // Enables forbidden() / unauthorized() interrupts used by the route guards.
    authInterrupts: true,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
};

export default nextConfig;
