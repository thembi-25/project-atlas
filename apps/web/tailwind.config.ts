import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Maps the CSS custom properties defined in app/globals.css to
      // Tailwind utility classes (`bg-muted`, `text-muted-foreground`,
      // `border-border`, …) — these tokens were defined in Sprint 0 but
      // never wired into the Tailwind theme, so classes using them
      // silently had no effect until this sprint's UI needed them.
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
      },
    },
  },
  plugins: [],
};

export default config;
