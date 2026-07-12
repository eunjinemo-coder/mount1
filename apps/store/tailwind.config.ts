import type { Config } from 'tailwindcss';
import preset from '@mount/config/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
