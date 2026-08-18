import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';

import { THEME_INIT_SCRIPT } from '../lib/theme-context';
import { Providers } from './providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Fonte da marca — usada no wordmark do logo (italic) e nos números da landing (normal).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DeliveryHub — controle unificado de delivery',
  description:
    'Camada única de controle para restaurantes que operam em múltiplas plataformas de delivery. Margem cross-platform, pausa multiplataforma e conciliação automatizada.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {/* Resolve theme before first paint to avoid flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
