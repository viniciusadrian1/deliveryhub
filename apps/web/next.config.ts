import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@deliveryhub/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
