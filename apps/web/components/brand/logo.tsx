'use client';

import clsx from 'clsx';

import { useTheme } from '../../lib/theme-context';

interface LogoProps {
  /** Altura em px. Largura ajusta pelo aspect ratio natural do PNG. */
  size?: number;
  className?: string;
}

/**
 * Logo do DeliveryHub. Serve o PNG certo por tema — dark tem "Delivery"
 * branco, light tem "Delivery" preto. Símbolo (D-pin) e "Hub" em laranja
 * nas duas versões.
 */
export function Logo({ size = 32, className }: LogoProps) {
  const { resolved } = useTheme();
  const src = resolved === 'dark' ? '/logo-dark.png' : '/logo-light.png';
  return (
    <img
      src={src}
      alt="DeliveryHub"
      style={{ height: size }}
      className={clsx('block w-auto select-none', className)}
    />
  );
}
