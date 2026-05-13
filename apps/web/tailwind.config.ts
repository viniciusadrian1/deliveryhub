import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // ====== Brand ======
        // Laranja queimado — distinto de iFood (vermelho puro) e Rappi (laranja vivo).
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // ====== Surfaces (dark first) ======
        surface: {
          base: '#08080d',
          raised: '#11111a',
          overlay: '#1a1a26',
          'border-subtle': '#26262f',
          border: '#33333f',
          'border-strong': '#4c4c5a',
        },
        // ====== Ink (texto) ======
        ink: {
          primary: '#fafafa',
          secondary: '#a8a8b3',
          tertiary: '#6f6f7e',
          inverse: '#08080d',
        },
        // ====== Semânticos ======
        success: {
          soft: 'rgba(16, 185, 129, 0.12)',
          DEFAULT: '#10b981',
          bright: '#34d399',
        },
        warning: {
          soft: 'rgba(245, 158, 11, 0.12)',
          DEFAULT: '#f59e0b',
          bright: '#fbbf24',
        },
        danger: {
          soft: 'rgba(220, 38, 38, 0.14)',
          DEFAULT: '#ef4444',
          bright: '#f87171',
        },
        info: {
          soft: 'rgba(59, 130, 246, 0.12)',
          DEFAULT: '#3b82f6',
        },
        // ====== Plataformas (cores oficiais) ======
        platform: {
          ifood: '#EA1D2C',
          rappi: '#FF441F',
          '99food': '#FE3324',
          keeta: '#FFCC00',
          ubereats: '#06C167',
          aiqfome: '#E2231A',
        },
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        DEFAULT:
          '0 4px 12px -2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        lg: '0 16px 32px -8px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        glow: '0 0 0 1px rgba(249, 115, 22, 0.45), 0 0 32px -4px rgba(249, 115, 22, 0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        'surface-gradient':
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)',
        'hero-radial':
          'radial-gradient(circle at top right, rgba(249, 115, 22, 0.15), transparent 50%), radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.1), transparent 50%)',
      },
    },
  },
  plugins: [],
};

export default config;
