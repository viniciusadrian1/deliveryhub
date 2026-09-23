'use client';

import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Logo } from '../../components/brand/logo';
import { ThemeToggle } from '../../components/layout/theme-toggle';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { r } from '../../lib/routes';

export default function LoginPage() {
  const { login } = useAuth();

  // Estados do formulário de login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados da recuperação de senha
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  async function onLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Preencha seu e-mail e sua senha.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('E-mail ou senha incorretos.');
        } else if (err.status === 400) {
          setError('Verifique os dados informados.');
        } else if (err.status === 429) {
          setError('Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.');
        } else if (err.status === 0) {
          setError('Não foi possível conectar ao servidor. Verifique se o backend está iniciado na porta 3333.');
        } else if (err.message) {
          setError(err.message);
        } else {
          setError('Não foi possível entrar agora. Tente novamente.');
        }
      } else {
        setError('Falha de conexão com o servidor. Verifique sua internet.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      setRecoveryError('Informe o e-mail cadastrado na sua conta.');
      return;
    }

    setRecoverySubmitting(true);
    setRecoveryError(null);

    try {
      await api('/auth/password/forgot', {
        method: 'POST',
        body: { email: recoveryEmail.trim() },
        skipAuth: true,
      });
      setRecoverySuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRecoveryError('Limite de tentativas atingido. Aguarde um minuto.');
      } else {
        setRecoveryError('Não foi possível processar o pedido agora. Tente novamente.');
      }
    } finally {
      setRecoverySubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col justify-between antialiased transition-colors duration-150 selection:bg-brand-500/20 selection:text-brand-600">
      
      {/* ==============================================================
          TOPO: LOGO MAIOR + SELETOR CLARO / ESCURO (SEM CRIAR CONTA NO TOPO)
          ============================================================== */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 sm:px-8 flex items-center justify-between">
        <Link
          href={r('/')}
          className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
          aria-label="DeliveryHub Início"
        >
          <Logo size={40} />
        </Link>

        {/* Alternador de tema Claro / Escuro */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* ==============================================================
          CORPO PRINCIPAL: FORMULÁRIO CENTRALIZADO E MINIMALISTA
          ============================================================== */}
      <main className="relative flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16 overflow-hidden">
        {/* Iluminação ambiente sutil */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-[#FF6B00]/5 blur-[120px] dark:bg-[#FF6B00]/10" />

        <div className="relative z-10 w-full max-w-[420px] mx-auto">
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 sm:p-9 shadow-lg dark:shadow-2xl dark:shadow-black/50 transition-colors">
            
            {!recoveryMode ? (
              /* --------------------------------------------------------
                 FLUXO PRINCIPAL DE LOGIN
                 -------------------------------------------------------- */
              <div>
                {/* Cabeçalho do Formulário */}
                <div className="mb-6 text-center">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary">
                    Entrar na sua conta
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-ink-secondary">
                    Digite suas credenciais para acessar o painel.
                  </p>
                </div>

                  {/* Mensagem de Erro */}
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

                  {/* Campos */}
                  <form onSubmit={onLoginSubmit} className="space-y-4" noValidate>
                    {/* Campo E-mail */}
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-xs font-semibold text-ink-primary mb-1.5"
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
                          id="login-email"
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
                          className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-raised dark:bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-sm disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Campo Senha */}
                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-semibold text-ink-primary mb-1.5"
                      >
                        Senha
                      </label>
                      <div className="relative">
                        <div
                          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-tertiary"
                          aria-hidden="true"
                        >
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          minLength={8}
                          disabled={submitting}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError(null);
                          }}
                          placeholder="Digite sua senha"
                          className="w-full h-11 pl-10 pr-10 rounded-lg bg-surface-raised dark:bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-sm disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={submitting}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-tertiary hover:text-ink-secondary focus:outline-none focus-visible:text-brand-500 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      {/* Recuperação de Senha */}
                      <div className="flex items-center justify-between text-xs mt-2.5">
                        <span className="text-ink-tertiary">Esqueceu sua senha?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryEmail(email);
                            setRecoveryError(null);
                            setRecoverySuccess(false);
                            setRecoveryMode(true);
                          }}
                          className="font-medium text-brand-500 hover:text-brand-600 transition-colors focus:outline-none focus-visible:underline"
                        >
                          Recuperar senha
                        </button>
                      </div>
                    </div>

                    {/* Botão Entrar */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full h-11 sm:h-12 flex items-center justify-center gap-2 rounded-lg bg-[#FF6B00] hover:bg-[#E85F00] active:bg-[#D95300] text-white font-bold text-sm transition-all duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            <span>Entrando...</span>
                          </>
                        ) : (
                          <span>Entrar</span>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Criação de Conta (apenas aqui na base do card) */}
                  <div className="mt-7 pt-6 border-t border-surface-border-subtle text-center text-xs text-ink-secondary">
                    <span>Ainda não tem uma conta? </span>
                    <Link
                      href={r('/signup')}
                      className="font-semibold text-brand-500 hover:text-brand-600 transition-colors focus:outline-none focus-visible:underline"
                    >
                      Criar conta
                    </Link>
                  </div>
                </div>
              ) : (
                /* --------------------------------------------------------
                   FLUXO DE RECUPERAÇÃO DE SENHA (INTEGRADO AO BACKEND)
                   -------------------------------------------------------- */
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary">
                      Recuperar sua senha
                    </h2>
                    <p className="mt-1.5 text-sm text-ink-secondary">
                      Digite seu e-mail e enviaremos as instruções para redefinir sua senha.
                    </p>
                  </div>

                  {recoverySuccess ? (
                    <div className="space-y-5">
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
                        <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-ink-primary mb-1">
                            Solicitação registrada
                          </p>
                          <p className="text-ink-secondary leading-relaxed">
                            Se o endereço informado estiver cadastrado, você receberá um link válido por 1 hora para redefinir sua senha.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryMode(false);
                          setRecoverySuccess(false);
                        }}
                        className="w-full h-11 flex items-center justify-center rounded-lg bg-surface-base hover:bg-surface-overlay border border-surface-border text-sm font-semibold text-ink-primary transition-colors"
                      >
                        Voltar ao login
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={onRecoverySubmit} className="space-y-4" noValidate>
                      {recoveryError && (
                        <div
                          role="alert"
                          aria-live="polite"
                          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-bright"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" aria-hidden="true" />
                          <span className="leading-relaxed">{recoveryError}</span>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="recovery-email"
                          className="block text-xs font-semibold text-ink-primary mb-1.5"
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
                            id="recovery-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            autoFocus
                            disabled={recoverySubmitting}
                            value={recoveryEmail}
                            onChange={(e) => {
                              setRecoveryEmail(e.target.value);
                              if (recoveryError) setRecoveryError(null);
                            }}
                            placeholder="seu@email.com"
                            className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-raised dark:bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-sm disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="pt-2 space-y-2.5">
                        <button
                          type="submit"
                          disabled={recoverySubmitting}
                          className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-[#FF6B00] hover:bg-[#E85F00] active:bg-[#D95300] text-white font-bold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
                        >
                          {recoverySubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <span>Continuar</span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryMode(false);
                            setRecoveryError(null);
                          }}
                          disabled={recoverySubmitting}
                          className="w-full h-10 flex items-center justify-center rounded-lg bg-transparent hover:bg-surface-base text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
                        >
                          Voltar ao login
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

      {/* ==============================================================
          RODAPÉ
          ============================================================== */}
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
