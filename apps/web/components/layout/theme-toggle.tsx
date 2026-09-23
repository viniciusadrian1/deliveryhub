'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme-context';

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border-subtle text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
    >
      {isDark ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
