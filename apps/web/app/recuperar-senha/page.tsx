'use client';

import {
  AlertCircle,
  Check,
  Loader2,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Logo } from '../../components/brand/logo';
import { ThemeToggle } from '../../components/layout/theme-toggle';
import { ApiError, api } from '../../lib/api';
import { r } from '../../lib/routes';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Informe seu e-mail cadastrado.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api('/auth/password/forgot', {
        method: 'POST',
        body: { email: email.trim() },
        skipAuth: true,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Limite de tentativas atingido. Aguarde um minuto.');
      } else {
        setError('Não foi possível processar o pedido agora. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col justify-between antialiased transition-colors duration-150 selection:bg-brand-500/20 selection:text-brand-600">
      
      {/* CABEÇALHO */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 sm:px-8 flex items-center justify-between">
        <Link
          href={r('/')}
          className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
          aria-label="DeliveryHub Início"
        >
          <Logo size={40} />
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* CORPO PRINCIPAL */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-[440px] rounded-2xl border border-surface-border bg-surface-raised p-8 sm:p-10 shadow-lg dark:shadow-2xl dark:shadow-black/50 transition-colors">
          <div className="mb-7">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary">
              Recuperar sua senha
            </h1>
            <p className="mt-1.5 text-sm text-ink-secondary leading-relaxed">
              Digite seu e-mail e enviaremos as instruções para redefinir sua senha.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-bright"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-ink-primary mb-1">Solicitação registrada</p>
                  <p className="text-ink-secondary leading-relaxed">
                    Se o endereço informado estiver cadastrado, você receberá um link válido por 1 hora para redefinir sua senha.
                  </p>
                </div>
              </div>
              <Link
                href={r('/login')}
                className="w-full h-11 flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-sm font-semibold text-white transition-colors"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="recuperar-email"
                  className="block text-xs font-semibold text-ink-secondary mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative">
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-tertiary"
                    aria-hidden="true"
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="recuperar-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    disabled={submitting}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="seu@email.com"
                    className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Continuar</span>
                  )}
                </button>

                <Link
                  href={r('/login')}
                  className="w-full h-10 flex items-center justify-center rounded-lg bg-transparent hover:bg-surface-base text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
                >
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* RODAPÉ */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-tertiary border-t border-surface-border-subtle">
        <span>© 2026 DeliveryHub</span>
        <div className="flex items-center gap-6">
          <Link
            href={r('/termos')}
            className="hover:text-ink-primary transition-colors focus:outline-none focus-visible:underline"
          >
            Termos de Uso
          </Link>
          <Link
            href={r('/privacidade')}
            className="hover:text-ink-primary transition-colors focus:outline-none focus-visible:underline"
          >
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
