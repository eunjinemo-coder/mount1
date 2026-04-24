import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    ignores: ['.next/**', 'next-env.d.ts', 'public/**'],
  },
];
