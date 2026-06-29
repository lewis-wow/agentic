import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/utils', '@repo/prisma'],
  devIndicators: false,
  experimental: {
    // Enables forbidden() / unauthorized() interrupts used by the route guards.
    authInterrupts: true,
  },
};

export default nextConfig;
