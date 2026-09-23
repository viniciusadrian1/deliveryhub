import type { Config } from 'tailwindcss';

/**
 * Color tokens use CSS variables defined in app/globals.css so the theme
 * (light / dark) can be swapped at runtime by toggling the `.dark` class on
 * <html>. Surfaces and ink store *RGB triplets* (e.g. `8 8 13`) so that
 * Tailwind opacity utilities like `bg-surface-base/50` still work via
 * `rgb(var(--surface-base) / <alpha-value>)`.
 *
 * Brand and platform colors are intentionally fixed: they are identity, not
 * theme.
 */
const surfaceRgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        brand: ['var(--font-brand)', 'var(--font-sans)', 'sans-serif'],
      },
      colors: {
        // ====== Brand (identidade visual padronizada com 3 tons) ======
        // Principal: #FF6B00 | Hover: #E85F00 | Secundaria: #FF8A33
        brand: {
          DEFAULT: '#FF6B00',
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#FF8A33',
          400: '#FF8A33',
          500: '#FF6B00',
          600: '#E85F00',
          700: '#E85F00',
          800: '#9a3412',
          900: '#7c2d12',
          primary: '#FF6B00',
          hover: '#E85F00',
          secondary: '#FF8A33',
        },
        // ====== Surfaces (themed via CSS vars) ======
        surface: {
          base: surfaceRgb('surface-base'),
          raised: surfaceRgb('surface-raised'),
          overlay: surfaceRgb('surface-overlay'),
          'border-subtle': surfaceRgb('surface-border-subtle'),
          border: surfaceRgb('surface-border'),
          'border-strong': surfaceRgb('surface-border-strong'),
        },
        // ====== Ink (themed via CSS vars) ======
        ink: {
          primary: surfaceRgb('ink-primary'),
          secondary: surfaceRgb('ink-secondary'),
          tertiary: surfaceRgb('ink-tertiary'),
          inverse: surfaceRgb('ink-inverse'),
        },
        // ====== Semantic (themed soft variants via CSS vars) ======
        success: {
          soft: 'var(--success-soft)',
          DEFAULT: '#10b981',
          bright: 'var(--success-bright)',
        },
        warning: {
          soft: 'var(--warning-soft)',
          DEFAULT: '#f59e0b',
          bright: 'var(--warning-bright)',
        },
        danger: {
          soft: 'var(--danger-soft)',
          DEFAULT: '#ef4444',
          bright: 'var(--danger-bright)',
        },
        info: {
          soft: 'var(--info-soft)',
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
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: '0 0 0 1px rgba(255, 107, 0, 0.35), 0 4px 16px -2px rgba(255, 107, 0, 0.25)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #FF6B00 0%, #E85F00 100%)',
        'surface-gradient': 'var(--surface-gradient)',
        'hero-radial': 'var(--hero-radial)',
      },
    },
  },
  plugins: [],
};

export default config;
