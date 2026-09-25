import { clearTokens, readTokens, writeTokens } from './tokens';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:3333';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestInit extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  /** Pula injetar Authorization (login, signup, refresh). */
  skipAuth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

export async function api<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/api${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };

  if (!init.skipAuth) {
    const tokens = readTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const res = await request(url, {
    ...init,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && !init.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const tokens = readTokens();
      if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
      const retry = await request(url, {
        ...init,
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      return finalize<T>(retry);
    }
  }

  return finalize<T>(res);
}

async function finalize<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json: unknown = text ? safeJson(text) : undefined;
  if (!res.ok) {
    throw new ApiError(errorMessage(res.status, json), res.status, json ?? text);
  }
  return (json ?? {}) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const tokens = readTokens();
  if (!tokens) return false;

  refreshInFlight = (async () => {
    try {
      const res = await request(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

const ERROR_MESSAGES: Record<string, string> = {
  already_a_member: 'Este e-mail já pertence a um membro desta organização.',
  pending_invitation_exists: 'Já existe um convite pendente para este e-mail. Reenvie o convite.',
  invitation_resend_cooldown: 'Aguarde 10 minutos antes de reenviar este convite.',
  cannot_invite_higher_role: 'Você não pode convidar alguém com uma função superior à sua.',
  invalid_invitation_token: 'Este convite expirou ou já foi utilizado. Peça um novo convite.',
  invitation_email_failed: 'Não foi possível enviar o e-mail. Tente reenviar o convite.',
  invalid_payroll_total: 'Verifique o salário e a quantidade de funcionários.',
  new_user_requires_name_and_password: 'Informe seu nome e uma senha para criar a conta.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  existing_user_password_required: 'Informe a senha da sua conta existente para aceitar o convite.',
};
export function errorMessage(status: number, body: unknown): string {
  const message =
    body && typeof body === 'object' && 'message' in body
      ? (body as { message: unknown }).message
      : null;
  if (typeof message === 'string' && ERROR_MESSAGES[message]) return ERROR_MESSAGES[message];
  const defaults: Record<number, string> = {
    400: 'Verifique os campos informados.',
    401: 'Sua sessão expirou. Entre novamente.',
    403: 'Você não tem permissão para esta ação.',
    404: 'Registro não encontrado.',
    409: 'Não foi possível salvar porque este registro já existe.',
    429: 'Muitas solicitações. Aguarde um pouco e tente novamente.',
  };
  return defaults[status] ?? 'O serviço está indisponível no momento. Tente novamente.';
}
async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      0,
    );
  }
}
