import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Tom semântico do valor */
  tone?: 'neutral' | 'success' | 'warning' | 'muted';
  /** Variação percentual vs período anterior */
  delta?: number;
  hint?: string;
}

const toneClasses = {
  neutral: 'text-ink-primary',
  success: 'text-success-bright',
  warning: 'text-warning-bright',
  muted: 'text-ink-secondary',
};

export function KpiCard({ label, value, icon: Icon, tone = 'neutral', delta, hint }: KpiCardProps) {
  const positive = delta !== undefined && delta >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div className="surface-card relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
          {label}
        </p>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p
        className={clsx(
          'mt-3 text-3xl font-bold tracking-tight tabular',
          toneClasses[tone],
        )}
      >
        {value}
      </p>
      {(delta !== undefined || hint) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold',
                positive
                  ? 'bg-success-soft text-success-bright'
                  : 'bg-danger-soft text-danger-bright',
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-ink-tertiary">{hint}</span>}
        </div>
      )}
    </div>
  );
}
