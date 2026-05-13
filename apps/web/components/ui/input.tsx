import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wider text-ink-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-tertiary">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={clsx(
              'h-11 w-full rounded-lg border bg-surface-raised text-sm text-ink-primary placeholder:text-ink-tertiary',
              'transition-colors duration-150 focus:outline-none',
              leftIcon ? 'pl-10 pr-3' : 'px-3',
              error
                ? 'border-danger focus:border-danger'
                : 'border-surface-border hover:border-surface-border-strong focus:border-brand-500',
              className,
            )}
            {...rest}
          />
        </div>
        {hint && !error && <p className="text-xs text-ink-tertiary">{hint}</p>}
        {error && (
          <p className="text-xs font-medium text-danger-bright" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
