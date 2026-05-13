import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from './providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DeliveryHub — controle unificado de delivery',
  description:
    'Camada única de controle para restaurantes que operam em múltiplas plataformas de delivery. Margem cross-platform, pausa multiplataforma e conciliação automatizada.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
