'use client';

import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Logo } from '../../../components/brand/logo';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { ApiError, api } from '../../../lib/api';
import { r } from '../../../lib/routes';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      setError('Link de redefinição inválido ou expirado.');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api('/auth/password/reset', {
        method: 'POST',
        body: { token, password },
        skipAuth: true,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Este link de recuperação é inválido ou já expirou.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('A senha informada não atende aos requisitos mínimos.');
      } else {
        setError('Não foi possível redefinir sua senha agora. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] rounded-2xl border border-surface-border-subtle bg-surface-raised p-8 sm:p-10 shadow-sm dark:shadow-2xl dark:shadow-black/50 transition-colors">
      <div className="mb-7">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary">
          Redefinir sua senha
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary leading-relaxed">
          Crie uma nova senha de no mínimo 8 caracteres para sua conta.
        </p>
      </div>

      {!token && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-bright"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" aria-hidden="true" />
          <span>Nenhum token de recuperação encontrado. Solicite um novo link de redefinição.</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-bright"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
            <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink-primary mb-1">Senha redefinida com sucesso</p>
              <p className="text-ink-secondary leading-relaxed">
                Sua senha foi alterada. Você já pode fazer login na plataforma.
              </p>
            </div>
          </div>
          <Link
            href={r('/login')}
            className="w-full h-11 flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-sm font-semibold text-white transition-colors"
          >
            Fazer login agora
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Nova Senha */}
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-semibold text-ink-secondary mb-1.5"
            >
              Nova senha
            </label>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-tertiary"
                aria-hidden="true"
              >
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="new-password"
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={submitting || !token}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Mínimo 8 caracteres"
                className="w-full h-11 pl-10 pr-10 rounded-lg bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={submitting || !token}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-tertiary hover:text-ink-secondary focus:outline-none transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Confirmar Senha */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-semibold text-ink-secondary mb-1.5"
            >
              Confirme a nova senha
            </label>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-tertiary"
                aria-hidden="true"
              >
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={submitting || !token}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Repita a nova senha"
                className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Botão de Envio */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={submitting || !token}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition-all duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Salvando nova senha...</span>
                </>
              ) : (
                <span>Salvar nova senha</span>
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
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col justify-between antialiased transition-colors duration-150 selection:bg-brand-500/20 selection:text-brand-600">
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

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <Suspense fallback={<div className="text-xs text-ink-secondary">Carregando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>

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
