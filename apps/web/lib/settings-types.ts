/**
 * Settings page contracts. Mirrors:
 * - notifications module DTOs (NotificationKind + Preference shape)
 * - compliance module (ConsentLog shape)
 * - organizations invitations endpoint
 *
 * Kept on the client side as plain types so we don't drag the API into the
 * Next bundle.
 */

export const NOTIFICATION_KINDS = [
  'new_order',
  'stock_low',
  'integration_error',
  'platform_disconnected',
  'payout_mismatch',
  'daily_goal',
  'invitation_accepted',
  'password_changed',
  'welcome',
  'system',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Friendly PT-BR labels + descriptions for each notification kind. */
export const NOTIFICATION_KIND_META: Record<
  NotificationKind,
  { label: string; description: string; group: 'operacional' | 'conta' }
> = {
  new_order: {
    label: 'Novo pedido',
    description: 'Avisa quando um pedido entra em qualquer plataforma.',
    group: 'operacional',
  },
  integration_error: {
    label: 'Erro de integração',
    description: 'Falhas na sincronização com iFood, Rappi, etc.',
    group: 'operacional',
  },
  platform_disconnected: {
    label: 'Plataforma desconectada',
    description: 'Token expirou ou autorização foi revogada.',
    group: 'operacional',
  },
  payout_mismatch: {
    label: 'Divergência de repasse',
    description: 'Conciliação bancária encontrou diferenças.',
    group: 'operacional',
  },
  stock_low: {
    label: 'Estoque baixo',
    description: 'Algum insumo caiu abaixo do estoque mínimo configurado.',
    group: 'operacional',
  },
  daily_goal: {
    label: 'Meta diária',
    description: 'Resumo do dia ao fechar o expediente.',
    group: 'operacional',
  },
  invitation_accepted: {
    label: 'Convite aceito',
    description: 'Um colega entrou na sua organização.',
    group: 'conta',
  },
  password_changed: {
    label: 'Senha alterada',
    description: 'Alerta de segurança quando a senha muda.',
    group: 'conta',
  },
  welcome: {
    label: 'Boas-vindas',
    description: 'Mensagem inicial após criar a conta.',
    group: 'conta',
  },
  system: {
    label: 'Avisos do sistema',
    description: 'Comunicados gerais do DeliveryHub.',
    group: 'conta',
  },
};

export interface NotificationPreference {
  userId: string;
  kind: NotificationKind;
  channelInApp: boolean;
  channelEmail: boolean;
}

export type ConsentKind = string; // backend uses an enum but client treats as opaque

export interface ConsentLogEntry {
  id: string;
  subjectKind: 'user' | 'customer';
  subjectId: string;
  kind: ConsentKind;
  version: string;
  accepted: boolean;
  ip: string | null;
  userAgent: string | null;
  at: string; // ISO
}

export interface InvitationCreated {
  id: string;
  expiresAt: string;
}

export type MembershipRole = 'owner' | 'manager' | 'staff' | 'financial';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  staff: 'Operador',
  financial: 'Financeiro',
};
