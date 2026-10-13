import type { Config } from 'tailwindcss';

// Cores vêm de CSS variables (tokens do tenant) — trocar marca não exige rebuild.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: token('primary'), hover: token('primary-hover'), soft: token('primary-soft') },
        surface: token('surface'),
        canvas: token('canvas'),
        ink: token('text'),
        muted: token('muted'),
        line: token('border'),
        success: token('success'),
        warning: token('warning'),
        danger: token('error'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderRadius: { xl: '12px', '2xl': '16px' },
      boxShadow: { card: '0 1px 2px rgba(23,33,43,0.06), 0 4px 16px rgba(23,33,43,0.04)' },
    },
  },
  plugins: [],
} satisfies Config;
