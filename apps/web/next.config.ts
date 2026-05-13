import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@deliveryhub/shared'],
  // typedRoutes desligado: gera os types só após build, o que quebra typecheck
  // num pipeline limpo. Re-habilitar quando rodarmos `next build` em CI.
  typedRoutes: false,
};

export default config;
