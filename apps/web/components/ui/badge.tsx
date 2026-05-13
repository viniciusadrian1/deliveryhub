import clsx from 'clsx';
import type { ReactNode } from 'react';

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

interface BadgeProps {
  children: ReactNode;
  color?: string; // override (cor de plataforma)
  variant?: Variant;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  neutral: 'bg-surface-overlay text-ink-secondary ring-1 ring-inset ring-surface-border',
  success: 'bg-success-soft text-success-bright ring-1 ring-inset ring-success/30',
  warning: 'bg-warning-soft text-warning-bright ring-1 ring-inset ring-warning/30',
  danger: 'bg-danger-soft text-danger-bright ring-1 ring-inset ring-danger/30',
  info: 'bg-info-soft text-info ring-1 ring-inset ring-info/30',
  brand: 'bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/30',
};

const dotClasses: Record<Variant, string> = {
  neutral: 'bg-ink-tertiary',
  success: 'bg-success-bright',
  warning: 'bg-warning-bright',
  danger: 'bg-danger-bright',
  info: 'bg-info',
  brand: 'bg-brand-500',
};

export function Badge({
  children,
  color,
  variant = 'neutral',
  dot = false,
  className,
}: BadgeProps) {
  if (color) {
    return (
      <span
        style={{ backgroundColor: color, color: '#fff' }}
        className={clsx(
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
          className,
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        variantClasses[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('h-1.5 w-1.5 rounded-full', dotClasses[variant])}
        />
      )}
      {children}
    </span>
  );
}
