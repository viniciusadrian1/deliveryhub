import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'DeliveryHub',
  description: 'Gestão unificada de restaurantes em múltiplas plataformas de delivery',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
