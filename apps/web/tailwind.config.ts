import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './src/app/globals.css'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1A1412',
          muted: '#5C524C',
        },
        canvas: '#FBF8F5',
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#F5F0EB',
        },
        border: '#E8E0D8',
        primary: {
          DEFAULT: '#B8860B',
          hover: '#9A7209',
          subtle: '#F5EDD8',
        },
        success: '#2D6A4F',
        warning: '#B45309',
        error: '#B91C1C',
        ai: '#6B4C9A',
        brand: {
          gold: '#B8860B',
          purple: '#6B4C9A',
          ink: '#1A1412',
          cream: '#FBF8F5',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(26, 20, 18, 0.06), 0 4px 12px rgba(26, 20, 18, 0.04)',
        raised: '0 4px 16px rgba(26, 20, 18, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
