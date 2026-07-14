import nextConfig from '@project-braids/config/eslint/next';

export default [
  ...nextConfig,
  {
    ignores: ['next-env.d.ts', '.next/**'],
  },
];
