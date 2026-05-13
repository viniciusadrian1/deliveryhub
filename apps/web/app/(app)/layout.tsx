'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Sidebar } from '../../components/layout/sidebar';
import { Topbar } from '../../components/layout/topbar';
import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

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
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto p-6 md:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
