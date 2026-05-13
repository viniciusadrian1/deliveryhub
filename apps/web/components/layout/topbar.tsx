'use client';

import { useAuth } from '../../lib/auth-context';
import { Button } from '../ui/button';

export function Topbar() {
  const { state, logout } = useAuth();
  if (!state) return null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">DeliveryHub</span>
        <span className="hidden text-sm text-zinc-500 md:inline">
          • {state.organization.name || 'Sua organização'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium">{state.user.name}</p>
          <p className="text-xs text-zinc-500">{state.role}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sair
        </Button>
      </div>
    </header>
  );
}
