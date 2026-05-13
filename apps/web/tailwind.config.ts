import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        platform: {
          ifood: '#EA1D2C',
          rappi: '#FF441F',
          '99food': '#FE3324',
          keeta: '#FFCC00',
          ubereats: '#06C167',
          aiqfome: '#E2231A',
        },
        status: {
          open: '#16A34A',
          paused: '#CA8A04',
          error: '#DC2626',
        },
      },
    },
  },
  plugins: [],
};

export default config;
