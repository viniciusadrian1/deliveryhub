'use client';

import clsx from 'clsx';
import {
  Boxes,
  LayoutGrid,
  UtensilsCrossed,
  TrendingUp,
  PauseCircle,
  Wallet,
  Plug,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '../brand/logo';
import { r } from '../../lib/routes';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Hub de Pedidos', href: '/hub', icon: LayoutGrid },
  { label: 'Cardápio', href: '/menu', icon: UtensilsCrossed },
  { label: 'Estoque', href: '/inventory', icon: Boxes, badge: 'novo' },
  { label: 'Preço & Margem', href: '/pricing', icon: TrendingUp },
  { label: 'Pausa', href: '/pause', icon: PauseCircle },
  { label: 'Financeiro', href: '/financial', icon: Wallet },
];

const SECONDARY_NAV: NavItem[] = [
  { label: 'Integrações', href: '/integrations', icon: Plug },
  { label: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border-subtle bg-surface-raised md:flex">
      <div className="px-5 py-5">
        <Logo size={28} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavSection items={PRIMARY_NAV} pathname={pathname} />
        <div className="my-4 px-2">
          <div className="h-px bg-surface-border-subtle" />
        </div>
        <NavSection label="Gerenciar" items={SECONDARY_NAV} pathname={pathname} />
      </nav>

      <div className="border-t border-surface-border-subtle px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-ink-tertiary">Plano · MVP</p>
        <p className="mt-0.5 text-xs text-ink-secondary">14 dias de teste grátis</p>
      </div>
    </aside>
  );
}

function NavSection({
  items,
  pathname,
  label,
}: {
  items: NavItem[];
  pathname: string | null;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <li key={item.href}>
                <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-tertiary">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-tertiary">
                    em breve
                  </span>
                </span>
              </li>
            );
          }
          return (
            <li key={item.href} className="relative">
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-500" />
              )}
              <Link
                href={r(item.href)}
                className={clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-surface-overlay text-ink-primary shadow-sm'
                    : 'text-ink-secondary hover:bg-surface-overlay/60 hover:text-ink-primary',
                )}
              >
                <Icon
                  className={clsx(
                    'h-4 w-4 shrink-0 transition-colors',
                    active
                      ? 'text-brand-400'
                      : 'text-ink-tertiary group-hover:text-ink-secondary',
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
