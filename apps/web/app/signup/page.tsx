'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { ApiError } from '../../lib/api.js';
import { useAuth } from '../../lib/auth-context.js';
import { r } from '../../lib/routes.js';

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
        setError('Verifique os campos. Senha precisa ter ao menos 8 caracteres.');
      } else {
        setError('Não foi possível criar a conta.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">Criar conta no DeliveryHub</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Em poucos segundos você está pronto pra conectar sua primeira plataforma.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="Seu nome"
            name="name"
            value={form.name}
            onChange={set('name')}
            required
            autoFocus
          />
          <Input
            label="Nome da loja"
            name="organizationName"
            placeholder="Ex.: Burger do João"
            value={form.organizationName}
            onChange={set('organizationName')}
            required
          />
          <Input
            label="E-mail"
            type="email"
            name="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            required
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
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-error dark:bg-red-950/40">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>

        <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Já tem conta?{' '}
          <Link href={r('/login')} className="font-medium underline">
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
