'use client';

import { ArrowRight, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AuthAside } from '../../components/brand/auth-aside';
import { Logo } from '../../components/brand/logo';
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
    <main className="flex min-h-screen">
      <AuthAside />

      <div className="flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          {/* logo só em mobile (no desktop fica no aside) */}
          <div className="mb-8 lg:hidden">
            <Logo size={32} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Entrar na sua conta</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Bem-vindo de volta. Continue de onde parou.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Input
              label="E-mail"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
              leftIcon={<Mail className="h-4 w-4" />}
              placeholder="voce@restaurante.com.br"
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
              leftIcon={<Lock className="h-4 w-4" />}
              placeholder="••••••••"
            />

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={submitting}
              fullWidth
              size="lg"
              rightIcon={!submitting && <ArrowRight className="h-4 w-4" />}
            >
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-secondary">
            Ainda não tem conta?{' '}
            <Link
              href={r('/signup')}
              className="font-semibold text-brand-400 transition-colors hover:text-brand-300"
            >
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
