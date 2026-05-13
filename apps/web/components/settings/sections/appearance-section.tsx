'use client';

import clsx from 'clsx';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType } from 'react';

import { type Theme, useTheme } from '../../../lib/theme-context';
import { SettingsSection } from '../section';

interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Claro',
    description: 'Bom para ambientes bem iluminados.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Escuro',
    description: 'Padrão do DeliveryHub. Foco em pedidos no calor da operação.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Seguir sistema',
    description: 'Acompanha a preferência do seu sistema operacional.',
    icon: Monitor,
  },
];

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSection
      title="Aparência"
      description="Defina como o DeliveryHub se mostra para você."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={active}
              className={clsx(
                'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                active
                  ? 'border-brand-500/60 bg-brand-500/5 shadow-glow'
                  : 'border-surface-border-subtle bg-surface-raised hover:border-surface-border-strong',
              )}
            >
              <span
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  active
                    ? 'bg-brand-500/15 text-brand-500'
                    : 'bg-surface-base text-ink-secondary',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p
                  className={clsx(
                    'text-sm font-semibold',
                    active ? 'text-brand-500' : 'text-ink-primary',
                  )}
                >
                  {opt.label}
                </p>
                <p className="mt-0.5 text-xs text-ink-secondary">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
