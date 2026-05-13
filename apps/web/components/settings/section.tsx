import clsx from 'clsx';
import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  /** When true, the body is padded; otherwise the caller controls padding. */
  padded?: boolean;
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  padded = true,
}: SettingsSectionProps) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-surface-border-subtle px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink-primary">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={clsx(padded && 'px-6 py-5')}>{children}</div>
    </section>
  );
}

interface FieldRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** A read-only key/value display row, used in profile-style sections. */
export function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-6">
      <div className="sm:w-40 sm:shrink-0">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-tertiary">
          {label}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-ink-tertiary">{hint}</p>}
      </div>
      <div className="text-sm text-ink-primary">{children}</div>
    </div>
  );
}

interface ComingSoonProps {
  children: ReactNode;
}

/** Soft visual marker for features that exist in the API only partially. */
export function ComingSoon({ children }: ComingSoonProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-base px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
      {children}
    </span>
  );
}
