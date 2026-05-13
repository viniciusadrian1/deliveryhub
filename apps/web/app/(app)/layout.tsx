'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Sidebar } from '../../components/layout/sidebar.js';
import { Topbar } from '../../components/layout/topbar.js';
import { useAuth } from '../../lib/auth-context.js';
import { r } from '../../lib/routes.js';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, loading } = useAuth();

  useEffect(() => {
    if (!loading && !state) {
      router.replace(r('/login'));
    }
  }, [loading, state, router]);

  if (loading || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Carregando…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
