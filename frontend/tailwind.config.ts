import type { Config } from 'tailwindcss';

/**
 * Tailwind configuration alignee sur la charte MHA des maquettes :
 * bleu institutionnel + accents eau, mode clair par defaut.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette MHA — sky (bleu institutionnel) et cyan (accents eau)
        primary: {
          DEFAULT: '#0284C7',
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },
        secondary: {
          DEFAULT: '#06B6D4',
          500: '#06B6D4',
          600: '#0891B2',
        },
        // Surfaces et bordures (slate)
        surface: '#FFFFFF',
        surface2: '#F8FAFC',
        muted: '#EFF7FB',
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        // Textes
        fg: {
          DEFAULT: '#0F172A',
          2: '#334155',
          muted: '#64748B',
        },
        // Couleurs metier (etats)
        success: { DEFAULT: '#16A34A', bg: '#DCFCE7' },
        warning: { DEFAULT: '#D97706', bg: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', bg: '#FEE2E2' },
        neutral: { DEFAULT: '#64748B', bg: '#F1F5F9' },
        info: { DEFAULT: '#0284C7', bg: '#E0F2FE' },
        // Sidebar fonce
        sidebar: {
          DEFAULT: '#0B2A3D',
          fg: '#CBD5E1',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['"Fira Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Fira Mono"', 'JetBrains Mono', 'SFMono-Regular', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Base 14 pour la densite tableau de bord
        xs: ['11px', '1.4'],
        sm: ['12.5px', '1.45'],
        base: ['14px', '1.5'],
        md: ['15px', '1.55'],
        lg: ['16px', '1.55'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, .04), 0 1px 1px rgba(15, 23, 42, .03)',
        DEFAULT: '0 1px 3px rgba(15, 23, 42, .06), 0 1px 2px rgba(15, 23, 42, .04)',
        lg: '0 10px 25px -5px rgba(15, 23, 42, .08), 0 8px 10px -6px rgba(15, 23, 42, .05)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
      },
      animation: {
        'fade-up': 'fadeUp 250ms ease-out both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
