import type { Config } from 'tailwindcss';

// PayPal's blues on a soft gray canvas, white cards, big type and round
// controls. Brand tokens from paypal.com's 2026 theme.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0B0D', muted: 'rgba(10,11,13,0.56)', soft: 'rgba(10,11,13,0.38)', faint: 'rgba(10,11,13,0.08)' },
        canvas: '#F4F5F7',
        fill: { DEFAULT: '#EEF0F3', strong: '#E4E7EB' },
        pp: {
          blue: '#0066F5',
          blueHover: '#0052C4',
          deep: '#002991',
          deepHover: '#1A3B8E',
          night: '#00103D',
          sky: '#60CDFF',
          surface: '#F2F3F5',
          surface2: '#E9EBEF',
          line: 'rgba(10,11,13,0.08)',
          gold: '#FFC439',
        },
        ok: { DEFAULT: '#0A7A3D', bg: '#E5F6EC' },
        ask: { DEFAULT: '#9A5B00', bg: '#FFF2DF', line: '#F5B65A' },
        no: { DEFAULT: '#C8102E', bg: '#FDECEF' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { card: '24px', tile: '16px', xl2: '20px' },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 1px rgba(16,24,40,0.02)',
        lift: '0 6px 24px rgba(16,24,40,0.08)',
        float: '0 18px 48px rgba(0,16,61,0.18)',
        pop: '0 24px 64px rgba(0,16,61,0.22)',
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        sheet: { '0%': { opacity: '0', transform: 'translateY(16px) scale(.98)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise .35s cubic-bezier(.2,.8,.2,1) both',
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        sheet: 'sheet .3s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
