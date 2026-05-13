'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { r } from '../../lib/routes';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
}

const ITEMS: NavItem[] = [
  { label: 'Hub', href: '/hub', icon: '📋' },
  { label: 'Cardápio', href: '/menu', icon: '🍔' },
  { label: 'Preço & Margem', href: '/pricing', icon: '💰' },
  { label: 'Pausa', href: '/pause', icon: '⏸️' },
  { label: 'Financeiro', href: '/financial', icon: '💳' },
  { label: 'Integrações', href: '/integrations', icon: '🔌' },
  { label: 'Configurações', href: '/settings', icon: '⚙️', disabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 md:block">
      <nav className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          if (item.disabled) {
            return (
              <span
                key={item.href}
                title="Em breve"
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 dark:text-zinc-600"
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[10px] uppercase tracking-wider">em breve</span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={r(item.href)}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
              )}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
