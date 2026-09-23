import clsx from 'clsx';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textColor?: string;
}

/** Scalable wordmark with no raster background or empty image margins. */
export function Logo({ size = 32, className, showText = true, textColor }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="DeliveryHub"
      className={clsx(
        'inline-flex shrink-0 select-none items-center gap-2.5 whitespace-nowrap',
        className,
      )}
      style={{ height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M20 3C11.7 3 5 9.5 5 17.5c0 10 15 20 15 20s15-10 15-20C35 9.5 28.3 3 20 3Z"
          fill="#FF6B00"
        />
        <path
          d="M17 11h4a7 7 0 0 1 0 14h-4M12 15h9M9 20h10"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span
          className={clsx('font-bold tracking-tight', textColor ?? 'text-ink-primary')}
          style={{ fontSize: size * 0.65, lineHeight: 1 }}
        >
          Delivery<span className="text-brand-500">Hub</span>
        </span>
      )}
    </span>
  );
}
