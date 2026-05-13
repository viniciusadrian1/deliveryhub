'use client';

import { ArrowRight, Lock, Mail, Store, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AuthAside } from '../../components/brand/auth-aside';
import { Logo } from '../../components/brand/logo';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

export default function SignupPage() {
  const { signup } = useAuth();
  const [form, setForm] = useState({
    name: '',
    organizationName: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup(form);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Este e-mail já está cadastrado.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Verifique os campos. A senha precisa ter ao menos 8 caracteres.');
      } else {
        setError('Não foi possível criar a conta.');
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
          <div className="mb-8 lg:hidden">
            <Logo size={32} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Criar conta grátis</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            14 dias para testar. Sem cartão de crédito.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Input
              label="Seu nome"
              name="name"
              value={form.name}
              onChange={set('name')}
              required
              autoFocus
              leftIcon={<User className="h-4 w-4" />}
              placeholder="João da Silva"
            />
            <Input
              label="Nome da loja"
              name="organizationName"
              value={form.organizationName}
              onChange={set('organizationName')}
              required
              leftIcon={<Store className="h-4 w-4" />}
              placeholder="Burger do João"
            />
            <Input
              label="E-mail"
              type="email"
              name="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
              leftIcon={<Mail className="h-4 w-4" />}
              placeholder="voce@restaurante.com.br"
            />
            <Input
              label="Senha"
              type="password"
              name="password"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={8}
              required
              leftIcon={<Lock className="h-4 w-4" />}
              hint="Mínimo 8 caracteres"
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
              {submitting ? 'Criando conta…' : 'Criar conta'}
            </Button>

            <p className="text-center text-[11px] text-ink-tertiary">
              Ao continuar, você concorda com os Termos de Uso e Política de Privacidade.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-ink-secondary">
            Já tem conta?{' '}
            <Link
              href={r('/login')}
              className="font-semibold text-brand-400 transition-colors hover:text-brand-300"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
