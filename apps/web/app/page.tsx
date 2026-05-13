import { APP_NAME } from '@deliveryhub/shared';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold">{APP_NAME}</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Camada única de controle sobre suas plataformas de delivery.
      </p>
      <p className="mt-8 rounded-md bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
        Fundação pronta. Sprint 1 começa pelo módulo de autenticação.
      </p>
    </main>
  );
}
