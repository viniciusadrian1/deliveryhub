import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@deliveryhub/shared'],
  typedRoutes: true,
};

export default config;
