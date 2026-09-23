'use client';

import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Store,
  User,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Logo } from '../../components/brand/logo';
import { ThemeToggle } from '../../components/layout/theme-toggle';
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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    if (error) setError(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.organizationName.trim() || !form.email.trim() || !form.password) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (form.password.length < 8) {
      setError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signup(form);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Este e-mail já está cadastrado.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Verifique os campos informados. A senha precisa ter ao menos 8 caracteres.');
      } else if (err instanceof ApiError && err.status === 0) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está iniciado na porta 3333.');
      } else if (err instanceof ApiError && err.message) {
        setError(err.message);
      } else {
        setError('Não foi possível criar a conta agora. Tente novamente.');
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* CORPO PRINCIPAL */}
      <main className="relative flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 overflow-hidden">
        {/* Iluminação ambiente sutil */}
        <div className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[#FF6B00]/5 blur-[120px] dark:bg-[#FF6B00]/10" />

        <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* COLUNA ESQUERDA: DIRETO AO PONTO, SEM TEXTÃO DE IA */}
          <div className="lg:col-span-6 flex flex-col justify-center lg:pr-4">
            
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-primary leading-tight">
              Todos os seus pedidos em uma só tela.
            </h1>

            <p className="mt-3 text-sm sm:text-base text-ink-secondary leading-relaxed">
              Centralize a operação do seu restaurante e elimine erros no horário de pico.
            </p>

            {/* 3 pontos objetivos */}
            <div className="mt-7 space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="text-sm text-ink-primary">
                  <strong>Zero comissão:</strong> mensalidade fixa, sem taxa por pedido.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="text-sm text-ink-primary">
                  <strong>Impressão direta:</strong> comanda na cozinha sem redigitar nada.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
                <span className="text-sm text-ink-primary">
                  <strong>14 dias grátis:</strong> teste completo, sem pedir cartão.
                </span>
              </div>
            </div>

            {/* Canais integrados com logos oficiais */}
            <div className="mt-8 pt-6 border-t border-surface-border-subtle">
              <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider block mb-3">
                Canais integrados
              </span>
              <div className="flex items-center gap-3">
                <Image
                  src="/platforms/ifood.png"
                  alt="iFood"
                  width={34}
                  height={34}
                  className="h-8.5 w-8.5 rounded-full shadow-sm"
                />
                <Image
                  src="/platforms/99food.png"
                  alt="99Food"
                  width={34}
                  height={34}
                  className="h-8.5 w-8.5 rounded-full shadow-sm"
                />
                <Image
                  src="/platforms/rappi.png"
                  alt="Rappi"
                  width={34}
                  height={34}
                  className="h-8.5 w-8.5 rounded-full shadow-sm"
                />
                <Image
                  src="/platforms/aiqfome.png"
                  alt="Aiqfome"
                  width={34}
                  height={34}
                  className="h-8.5 w-8.5 rounded-full shadow-sm"
                />
                <Image
                  src="/platforms/keeta.png"
                  alt="Keeta"
                  width={34}
                  height={34}
                  className="h-8.5 w-8.5 rounded-full shadow-sm"
                />
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA: FORMULÁRIO */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px] rounded-2xl border border-surface-border bg-surface-raised p-7 sm:p-8 shadow-lg dark:shadow-2xl dark:shadow-black/50 transition-colors">
              
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight text-ink-primary">
                  Criar conta
                </h2>
                <p className="mt-1 text-xs text-ink-secondary">
                  Comece seu teste de 14 dias em menos de 1 minuto.
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

              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                {/* Nome */}
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Seu nome
                  </label>
                  <div className="relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-tertiary"
                      aria-hidden="true"
                    >
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="signup-name"
                      name="name"
                      type="text"
                      required
                      autoFocus
                      disabled={submitting}
                      value={form.name}
                      onChange={set('name')}
                      placeholder="Nome completo"
                      className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-raised dark:bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-sm disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Nome do Restaurante */}
                <div>
                  <label
                    htmlFor="signup-org"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Nome do restaurante
                  </label>
                  <div className="relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-tertiary"
                      aria-hidden="true"
                    >
                      <Store className="h-4 w-4" />
                    </div>
                    <input
                      id="signup-org"
                      name="organizationName"
                      type="text"
                      required
                      disabled={submitting}
                      value={form.organizationName}
                      onChange={set('organizationName')}
                      placeholder="Nome do seu negócio"
                      className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-raised dark:bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-sm disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div>
                  <label
                    htmlFor="signup-email"
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
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={submitting}
                      value={form.email}
                      onChange={set('email')}
                      placeholder="seu@restaurante.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-surface-raised dark:bg-surface-base border border-surface-border text-sm text-ink-primary placeholder:text-ink-tertiary transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-sm disabled:opacity-50 disabled:bg-surface-raised disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label
                    htmlFor="signup-password"
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
                      id="signup-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      disabled={submitting}
                      value={form.password}
                      onChange={set('password')}
                      placeholder="Mínimo 8 caracteres"
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
                </div>

                {/* Botão de Envio */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 sm:h-12 flex items-center justify-center gap-2 rounded-lg bg-[#FF6B00] hover:bg-[#E85F00] active:bg-[#D95300] text-white font-bold text-sm transition-all duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Criando conta...</span>
                      </>
                    ) : (
                      <span>Começar teste grátis</span>
                    )}
                  </button>
                </div>

                {/* Termos Legais */}
                <p className="text-center text-[11px] text-ink-tertiary pt-1 leading-relaxed">
                  Ao continuar, você concorda com os{' '}
                  <Link href={r('/termos')} className="underline hover:text-ink-primary transition-colors">
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link href={r('/privacidade')} className="underline hover:text-ink-primary transition-colors">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>

              {/* Link para Login */}
              <div className="mt-6 pt-5 border-t border-surface-border-subtle text-center text-xs text-ink-secondary">
                <span>Já tem conta? </span>
                <Link
                  href={r('/login')}
                  className="font-semibold text-brand-500 hover:text-brand-600 transition-colors focus:outline-none focus-visible:underline"
                >
                  Entrar
                </Link>
              </div>

            </div>
          </div>

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
