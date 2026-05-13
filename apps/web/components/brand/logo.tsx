import clsx from 'clsx';

interface LogoProps {
  size?: number;
  wordmark?: boolean;
  className?: string;
}

/**
 * Logo do DeliveryHub.
 * - Mark: hexágono arredondado em laranja queimado da marca + monograma "DH"
 *   estilizado (lembrando 1) embalagem hexagonal de comida, 2) seta apontando
 *   pra frente (centralização operacional).
 * - Wordmark: "Delivery" em peso regular, "Hub" em peso bold com gradiente.
 */
export function Logo({ size = 32, wordmark = true, className }: LogoProps) {
  return (
    <div className={clsx('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="dh-mark-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fb923c" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        {/* Hexágono arredondado — sugere embalagem/pacote */}
        <path
          d="M20 2 L34.6 10.5 V29.5 L20 38 L5.4 29.5 V10.5 Z"
          fill="url(#dh-mark-grad)"
        />
        {/* Monograma "DH" simplificado, branco */}
        <path
          d="M12.5 13.5 L12.5 26.5 L17 26.5 C20.5 26.5 22.5 24 22.5 20 C22.5 16 20.5 13.5 17 13.5 Z M15 16 L17 16 C18.8 16 19.8 17.4 19.8 20 C19.8 22.6 18.8 24 17 24 L15 24 Z"
          fill="white"
        />
        <path
          d="M24 13.5 L26.5 13.5 L26.5 18.8 L29 18.8 L29 13.5 L31.5 13.5 L31.5 26.5 L29 26.5 L29 21.2 L26.5 21.2 L26.5 26.5 L24 26.5 Z"
          fill="white"
        />
      </svg>
      {wordmark && (
        <span className="text-base font-bold tracking-tight text-ink-primary">
          Delivery<span className="bg-brand-gradient bg-clip-text text-transparent">Hub</span>
        </span>
      )}
    </div>
  );
}
