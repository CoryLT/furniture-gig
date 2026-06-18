import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm neutral base
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // Brand colors
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Brand gold ramp — remaps Tailwind's default `amber-*` utilities to
        // true gold (was orange-yellow). `gold-*` is an alias of the same ramp.
        amber: {
          50: '#FBF7E8',
          100: '#F6EBC2',
          200: '#EEDB94',
          300: '#E4C65C',
          400: '#D9B032',
          500: '#C99E1E',
          600: '#AC8417',
          700: '#836314',
          800: '#5E4711',
          900: '#41310B',
        },
        gold: {
          50: '#FBF7E8',
          100: '#F6EBC2',
          200: '#EEDB94',
          300: '#E4C65C',
          400: '#D9B032',
          500: '#C99E1E',
          600: '#AC8417',
          700: '#836314',
          800: '#5E4711',
          900: '#41310B',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
export default config
