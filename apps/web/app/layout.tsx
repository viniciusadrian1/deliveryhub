import type { Metadata } from 'next';

import { Providers } from './providers.js';

import './globals.css';

export const metadata: Metadata = {
  title: 'DeliveryHub',
  description: 'Gestão unificada de restaurantes em múltiplas plataformas de delivery',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 antialiased dark:bg-zinc-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
