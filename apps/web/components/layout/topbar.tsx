'use client';

import { Bell, ChevronDown, LogOut, Store, User } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../../lib/auth-context';

export function Topbar() {
  const { state, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!state) return null;

  const orgInitial = (state.organization.name || 'L').charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-border-subtle bg-surface-raised/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
          <Store className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-primary">
            {state.organization.name || 'Sua organização'}
          </p>
          <p className="text-[11px] text-ink-tertiary">Loja única · Brasil</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px bg-surface-border-subtle" />
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-overlay"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {orgInitial}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold leading-tight text-ink-primary">
                {state.user.name}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                {state.role}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-ink-tertiary" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-surface-border bg-surface-overlay shadow-lg">
                <div className="border-b border-surface-border-subtle px-3 py-2.5">
                  <p className="text-sm font-medium text-ink-primary">{state.user.name}</p>
                  <p className="text-xs text-ink-secondary">{state.user.email}</p>
                </div>
                <ul className="py-1">
                  <li>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-raised hover:text-ink-primary"
                      onClick={() => setMenuOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Minha conta
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void logout();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-raised hover:text-ink-primary"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
