'use client';

import clsx from 'clsx';
import { Monitor, Moon, Sun } from 'lucide-react';

import { type Theme, useTheme } from '../../lib/theme-context';

const ORDER: Theme[] = ['light', 'dark', 'system'];
const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;
const LABELS = {
  light: 'Tema claro',
  dark: 'Tema escuro',
  system: 'Seguir sistema',
} as const;

/**
 * Compact 3-state segmented toggle. Click cycles light → dark → system →
 * light. The currently-active mode is highlighted; we surface all three so
 * the "system" option remains discoverable.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="flex items-center gap-0.5 rounded-lg border border-surface-border-subtle bg-surface-base p-0.5"
    >
      {ORDER.map((t) => {
        const Icon = ICONS[t];
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABELS[t]}
            title={LABELS[t]}
            onClick={() => setTheme(t)}
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              active
                ? 'bg-surface-raised text-brand-500 shadow-sm'
                : 'text-ink-tertiary hover:text-ink-primary',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
