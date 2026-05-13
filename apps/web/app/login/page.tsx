'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('E-mail ou senha incorretos.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Verifique os dados informados.');
      } else {
        setError('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">DeliveryHub</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Entre na sua conta
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
          <Input
            label="Senha"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            minLength={8}
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-error dark:bg-red-950/40">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Não tem conta?{' '}
          <Link href={r('/signup')} className="font-medium underline">
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  );
}
