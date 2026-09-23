'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { Logo } from '../../../../components/brand/logo';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { r } from '../../../../lib/routes';

export default function AcceptInvitationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { acceptInvitation } = useAuth();
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);
  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () =>
      api<{ email: string; organizationName: string; existingUser: boolean }>(
        `/auth/invitations/preview?token=${encodeURIComponent(token!)}`,
        { skipAuth: true },
      ),
    enabled: !!token,
    retry: false,
  });
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Logo size={40} />
        <h1 className="text-2xl font-bold">Entrar na equipe</h1>
        {token === null || (!!token && preview.isLoading) ? <p>Carregando convite…</p> : null}
        {(token === '' || preview.error) && (
          <p role="alert" className="text-danger-bright">
            {preview.error?.message ?? 'Link de convite inválido. Peça um novo convite.'}
          </p>
        )}
        {preview.data && (
          <>
            <p>
              Você foi convidado para <b>{preview.data.organizationName}</b> com o e-mail{' '}
              {preview.data.email}.
            </p>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setError('');
                try {
                  await acceptInvitation({
                    token: token!,
                    name: preview.data.existingUser ? undefined : name.trim(),
                    password,
                  });
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {!preview.data.existingUser && (
                <Input
                  label="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                />
              )}
              <Input
                label={preview.data.existingUser ? 'Senha da sua conta' : 'Crie sua senha'}
                type="password"
                autoComplete={preview.data.existingUser ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
              />
              {error && (
                <p role="alert" className="text-sm text-danger-bright">
                  {error}
                </p>
              )}
              <Button type="submit" loading={submitting} fullWidth>
                Aceitar convite
              </Button>
            </form>
          </>
        )}
        <Link href={r('/login')} className="text-sm text-brand-500">
          Voltar para entrar
        </Link>
      </div>
    </main>
  );
}
