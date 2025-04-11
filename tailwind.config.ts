import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './app/styles/**/*.{css,scss}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
