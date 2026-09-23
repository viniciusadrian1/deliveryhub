'use client';

import clsx from 'clsx';
import Image from 'next/image';

interface PlatformLogoProps {
  code?: string;
  platform?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showFallbackText?: boolean;
}

const PLATFORM_LOGOS: Record<
  string,
  { src: string; alt: string }
> = {
  ifood: { src: '/platforms/ifood.png', alt: 'iFood' },
  '99food': { src: '/platforms/99food.png', alt: '99Food' },
  rappi: { src: '/platforms/rappi.png', alt: 'Rappi' },
  keeta: { src: '/platforms/keeta.png', alt: 'Keeta' },
  ubereats: { src: '/platforms/ubereats.png', alt: 'Uber Eats' },
  aiqfome: { src: '/platforms/aiqfome.png', alt: 'AiQfome' },
};

export function PlatformLogo({
  code,
  platform,
  name,
  size = 'md',
  className,
  showFallbackText = true,
}: PlatformLogoProps) {
  const normCode = (code || platform || '').toLowerCase().trim();
  const config = PLATFORM_LOGOS[normCode];
  const displayName = name || config?.alt || code || platform || 'Plataforma';

  // Dimensões quadradas 1:1 proporcionais
  const sizeStyles = {
    xs: 'h-6 w-6 rounded-md p-0.5',
    sm: 'h-8 w-8 rounded-lg p-1',
    md: 'h-10 w-10 rounded-xl p-1.5',
    lg: 'h-12 w-12 rounded-2xl p-2',
  };

  const pxSizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
  };

  if (!config) {
    return showFallbackText ? (
      <span
        className={clsx(
          'inline-flex items-center justify-center font-bold uppercase text-[10px] bg-surface-raised border border-surface-border text-ink-primary px-1.5 py-0.5 rounded',
          className,
        )}
      >
        {displayName.slice(0, 3)}
      </span>
    ) : null;
  }

  return (
    <span
      title={displayName}
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm ring-1 ring-black/10 select-none transition-transform hover:scale-105',
        sizeStyles[size],
        className,
      )}
    >
      <Image
        src={config.src}
        alt={displayName}
        width={pxSizes[size]}
        height={pxSizes[size]}
        className="h-full w-full object-contain rounded"
        unoptimized
      />
    </span>
  );
}
