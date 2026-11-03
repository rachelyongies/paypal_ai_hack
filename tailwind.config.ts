import type { Config } from 'tailwindcss';

// Tokens taken from paypal.com's live 2026 theme (pds60): black pill buttons,
// #0066F5 blue, #002991 deep blue, #F5F7FA surfaces, 24px cards.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#000000', muted: 'rgba(0,0,0,0.63)', soft: 'rgba(0,0,0,0.45)' },
        pp: {
          blue: '#0066F5',
          blueHover: '#0052C4',
          deep: '#002991',
          deepHover: '#1A3B8E',
          sky: '#60CDFF',
          surface: '#F5F7FA',
          surface2: '#EDF0F2',
          line: 'rgba(0,0,0,0.16)',
          gold: '#FFC439',
        },
        ok: { DEFAULT: '#0F8514', bg: '#E8F5E9' },
        ask: { DEFAULT: '#8A4B00', bg: '#FFF1DD', line: '#F5B65A' },
        no: { DEFAULT: '#C41E1E', bg: '#FDECEC' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { card: '24px', tile: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,41,145,0.06)',
        pop: '0 12px 40px rgba(0,20,60,0.18)',
      },
      keyframes: {
        flash: { '0%': { backgroundColor: 'rgba(0,102,245,0.14)' }, '100%': { backgroundColor: 'transparent' } },
        rise: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        flash: 'flash 1.6s ease-out',
        rise: 'rise .35s ease-out both',
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
