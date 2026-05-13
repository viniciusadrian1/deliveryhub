import type { Route } from 'next';

/**
 * Pequeno helper para escapar do strict typing de rotas do Next 15 sem
 * recorrer a `as any`. Quando habilitarmos `typedRoutes: true` em CI (após
 * `next build` gerar `.next/types/routes.d.ts`), trocamos esta função
 * por uma noop e ganhamos a checagem estática.
 */
export function r(path: string): Route {
  return path as Route;
}
