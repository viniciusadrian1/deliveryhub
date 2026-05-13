import clsx from 'clsx';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  const style = color ? { backgroundColor: color, color: '#fff' } : undefined;
  return (
    <span
      style={style}
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        !color && 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
        className,
      )}
    >
      {children}
    </span>
  );
}
