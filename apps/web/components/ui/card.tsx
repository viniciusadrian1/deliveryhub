import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children: ReactNode;
}

export function Card({ className, interactive, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-surface-border-subtle bg-surface-raised bg-surface-gradient shadow-sm',
        interactive &&
          'transition-all duration-150 hover:border-surface-border hover:shadow-DEFAULT',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <header
      className={clsx(
        'flex items-start justify-between gap-4 border-b border-surface-border-subtle px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-primary">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <footer
      className={clsx(
        'flex items-center justify-end gap-2 border-t border-surface-border-subtle bg-surface-base/40 px-5 py-3',
        className,
      )}
    >
      {children}
    </footer>
  );
}
