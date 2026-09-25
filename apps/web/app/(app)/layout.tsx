'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Sidebar } from '../../components/layout/sidebar';
import { Topbar } from '../../components/layout/topbar';
import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, loading } = useAuth();
  const isStoreOnboarding = pathname === r('/select-store') || pathname === r('/stores/new');

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
    <div className={isStoreOnboarding ? 'min-h-screen' : 'flex min-h-screen flex-col'}>
      {isStoreOnboarding ? children : (
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-7">
            <div className="mx-auto w-full max-w-[1720px]">{children}</div>
          </main>
        </div>
      </div>
      )}
    </div>
  );
}
