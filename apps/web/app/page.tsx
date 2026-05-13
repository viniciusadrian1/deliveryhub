'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../lib/auth-context';
import { r } from '../lib/routes';

export default function HomePage() {
  const router = useRouter();
  const { state, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(state ? r('/hub') : r('/login'));
  }, [loading, state, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-ink-tertiary">Carregando…</p>
    </main>
  );
}
