import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-sm hover:shadow-glow active:translate-y-px',
  secondary:
    'border border-surface-border bg-surface-raised text-ink-primary hover:border-surface-border-strong hover:bg-surface-overlay',
  ghost: 'text-ink-secondary hover:bg-surface-raised hover:text-ink-primary',
  danger: 'bg-danger text-white hover:bg-danger-bright',
  subtle:
    'bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 ring-1 ring-inset ring-brand-500/20',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
}
