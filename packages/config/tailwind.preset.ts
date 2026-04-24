// Tailwind preset placeholder. 실제 preset 은 shadcn/ui New York 테마와
// packages/config/tokens.css 를 기반으로 Phase 0 후반에 채워 넣는다.
// 참조: 04_DESIGN_SYSTEM/08_TOKEN_EXPORT.md, 05_TECH_STACK/01_STACK_DECISIONS.md §1

import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--mp-font-sans)'],
      },
      colors: {
        'mp-accent': 'var(--mp-color-accent)',
        'mp-danger': 'var(--mp-color-danger)',
        'mp-success': 'var(--mp-color-success)',
      },
    },
  },
  plugins: [],
};

export default preset;
