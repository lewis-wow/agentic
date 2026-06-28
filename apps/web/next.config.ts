import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui'],
  devIndicators: false,
};

export default nextConfig;
