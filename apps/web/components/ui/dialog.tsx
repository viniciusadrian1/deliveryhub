'use client';

import clsx from 'clsx';
import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={clsx(
          'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-overlay shadow-lg',
          SIZES[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-border-subtle px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-ink-secondary">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-tertiary transition-colors hover:bg-surface-raised hover:text-ink-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-surface-border-subtle bg-surface-base/40 px-6 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
