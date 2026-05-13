'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../lib/auth-context.js';
import { r } from '../lib/routes.js';

export default function HomePage() {
  const router = useRouter();
  const { state, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(state ? r('/hub') : r('/login'));
  }, [loading, state, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-zinc-500">Carregando…</p>
    </main>
  );
}
