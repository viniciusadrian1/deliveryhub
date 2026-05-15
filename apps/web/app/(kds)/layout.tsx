'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

/**
 * Layout do Kitchen Display System.
 *
 * Intencionalmente minimal: SEM sidebar e SEM topbar. A cozinha precisa
 * de tela limpa, focada nos pedidos. O único guardrail é a auth — quem
 * acessa precisa estar logado (a cozinha vai abrir num tablet/monitor
 * dedicado já logado de uma vez).
 *
 * Body fica em modo "kiosque": tema escuro fixo (independe do toggle de
 * tema global) — KDS de cozinha em fundo claro é desconfortável sob
 * luminária forte. Color forçado via classe `dark` no html.
 */
export default function KdsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, loading } = useAuth();

  useEffect(() => {
    if (!loading && !state) {
      router.replace(r('/login'));
    }
  }, [loading, state, router]);

  // KDS sempre em tema escuro pra ambiente de cozinha.
  useEffect(() => {
    const previous = document.documentElement.classList.contains('dark');
    document.documentElement.classList.add('dark');
    return () => {
      if (!previous) document.documentElement.classList.remove('dark');
    };
  }, []);

  if (loading || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </main>
    );
  }

  return <div className="min-h-screen bg-surface-base">{children}</div>;
}
