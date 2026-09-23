'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

interface Notification {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { state } = useAuth();
  const qc = useQueryClient();
  const key = ['notifications', state?.user.id, state?.organization.id];
  const count = useQuery({
    queryKey: [...key, 'count'],
    queryFn: () => api<{ count: number }>('/notifications/unread-count'),
    enabled: !!state,
    refetchInterval: 30000,
  });
  const list = useQuery({
    queryKey: [...key, 'list'],
    queryFn: () => api<Notification[]>('/notifications?limit=50'),
    enabled: open && !!state,
    refetchInterval: open ? 30000 : false,
  });
  const read = useMutation({
    mutationFn: (id?: string) =>
      api(id ? `/notifications/${id}/read` : '/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const unread = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/unread`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    // Ao abrir as notificações, marca como lidas automaticamente
    if (willOpen && count.data?.count && count.data.count > 0) {
      read.mutate(undefined);
    }
  };

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Notificações${count.data?.count ? `, ${count.data.count} não lidas` : ''}`}
        aria-expanded={open}
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-overlay"
      >
        <Bell className="h-4 w-4" />
        {!!count.data?.count && (
          <span className="absolute -right-1 -top-1 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
            {count.data.count > 99 ? '99+' : count.data.count}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar notificações"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            aria-label="Central de notificações"
            className="fixed right-3 top-16 z-50 w-[calc(100vw-1.5rem)] max-w-sm rounded-xl border border-surface-border bg-surface-raised shadow-xl sm:absolute sm:right-0 sm:top-12 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-surface-border-subtle p-4">
              <h2 className="text-base font-semibold">Notificações</h2>
              <button aria-label="Fechar painel" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {!!count.data?.count && (
              <button
                disabled={read.isPending}
                onClick={() => read.mutate(undefined)}
                className="px-4 py-2 text-xs font-semibold text-brand-500 hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
            {(list.error || read.error || unread.error) && (
              <p role="alert" className="px-4 py-2 text-sm text-danger-bright">
                {(list.error || read.error || unread.error)?.message}
              </p>
            )}
            <div className="max-h-[60vh] overflow-y-auto">
              {list.isLoading && <p className="p-4 text-sm">Carregando notificações…</p>}
              {list.isSuccess && list.data.length === 0 && (
                <p className="p-6 text-sm text-ink-secondary">
                  Você está em dia. Nenhuma notificação por aqui.
                </p>
              )}
              {list.data?.map((n) => {
                const href =
                  n.linkUrl?.startsWith('/') &&
                  !n.linkUrl.startsWith('//') &&
                  !n.linkUrl.includes('\\')
                    ? r(n.linkUrl.replace('/settings/team', '/settings#members'))
                    : null;
                return (
                  <article
                    key={n.id}
                    className={`border-t border-surface-border-subtle p-4 transition-colors ${n.readAt ? '' : 'bg-brand-500/5'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-primary">{n.title}</p>
                      {!n.readAt && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500 mt-1.5" title="Não lida" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-secondary">{n.body}</p>
                    <time className="mt-2 block text-xs text-ink-tertiary">
                      {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </time>
                    <div className="mt-2 flex items-center justify-between gap-3 pt-1">
                      {href && (
                        <Link
                          href={href}
                          onClick={() => {
                            if (!n.readAt) read.mutate(n.id);
                            setOpen(false);
                          }}
                          className="text-xs font-semibold text-brand-500 hover:underline"
                        >
                          Ver detalhes
                        </Link>
                      )}
                      {!n.readAt ? (
                        <button
                          disabled={read.isPending}
                          onClick={() => read.mutate(n.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary"
                        >
                          <Check className="h-3.5 w-3.5 text-brand-500" /> Marcar como lida
                        </button>
                      ) : (
                        <button
                          disabled={unread.isPending}
                          onClick={() => unread.mutate(n.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-ink-tertiary hover:text-ink-primary"
                          title="Voltar notificação para não lida"
                        >
                          Marcar como não lida
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
