import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-raised/40 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
