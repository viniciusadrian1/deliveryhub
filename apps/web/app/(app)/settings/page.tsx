'use client';

import clsx from 'clsx';
import {
  Bell,
  Building2,
  Palette,
  Shield,
  User as UserIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { AccountSection } from '../../../components/settings/sections/account-section';
import { AppearanceSection } from '../../../components/settings/sections/appearance-section';
import { MembersSection } from '../../../components/settings/sections/members-section';
import { NotificationsSection } from '../../../components/settings/sections/notifications-section';
import { OrganizationSection } from '../../../components/settings/sections/organization-section';
import { PrivacySection } from '../../../components/settings/sections/privacy-section';

type SectionKey =
  | 'account'
  | 'organization'
  | 'members'
  | 'notifications'
  | 'appearance'
  | 'privacy';

interface NavItem {
  key: SectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  {
    key: 'account',
    label: 'Conta',
    description: 'Perfil, senha e sessões',
    icon: UserIcon,
  },
  {
    key: 'organization',
    label: 'Organização & Loja',
    description: 'Dados da empresa e ponto de venda',
    icon: Building2,
  },
  {
    key: 'members',
    label: 'Membros',
    description: 'Convide colegas e defina funções',
    icon: Users,
  },
  {
    key: 'notifications',
    label: 'Notificações',
    description: 'Hub, e-mail e tipos de alerta',
    icon: Bell,
  },
  {
    key: 'appearance',
    label: 'Aparência',
    description: 'Tema claro ou escuro',
    icon: Palette,
  },
  {
    key: 'privacy',
    label: 'Privacidade & LGPD',
    description: 'Exportar, consentimentos, anonimizar',
    icon: Shield,
  },
];

const SECTION_COMPONENTS: Record<SectionKey, () => ReactElement | null> = {
  account: AccountSection,
  organization: OrganizationSection,
  members: MembersSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  privacy: PrivacySection,
};

export default function SettingsPage() {
  const [active, setActive] = useState<SectionKey>('account');
  const ActiveSection = SECTION_COMPONENTS[active];

  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <h1>Configurações</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Conta, organização, equipe, notificações e privacidade.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav
          aria-label="Seções de configurações"
          className="surface-card sticky top-6 self-start overflow-hidden p-2"
        >
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => setActive(item.key)}
                    className={clsx(
                      'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-brand-500/10 text-ink-primary'
                        : 'text-ink-secondary hover:bg-surface-overlay hover:text-ink-primary',
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                        isActive
                          ? 'bg-brand-500/15 text-brand-500'
                          : 'text-ink-tertiary group-hover:text-ink-secondary',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={clsx(
                          'text-sm font-semibold',
                          isActive ? 'text-ink-primary' : 'text-ink-primary/80',
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-tertiary">
                        {item.description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <ActiveSection />
        </div>
      </div>
    </div>
  );
}
