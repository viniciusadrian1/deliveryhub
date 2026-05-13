import config from '@deliveryhub/config/eslint';

export default [
  ...config,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
