import nextConfig from '@project-braids/config/eslint/next';

export default [
  ...nextConfig,
  {
    ignores: ['next-env.d.ts', '.next/**'],
  },
];

// If you are using Flat Config (eslint.config.js)
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];