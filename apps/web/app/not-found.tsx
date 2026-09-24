'use client';

import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <SearchX className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-brand-400">Erro 404</p>
        <h1 className="mt-2 text-3xl font-black text-ink-primary">Página não encontrada</h1>
        <p className="mt-3 text-sm text-ink-secondary">O endereço pode ter expirado ou não existe mais no Delivery Hub.</p>
        <Link href="/hub" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-400">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Hub
        </Link>
      </div>
    </main>
  );
}
