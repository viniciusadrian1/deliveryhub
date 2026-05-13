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

  const res = await fetch(url, {
    ...init,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && !init.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const tokens = readTokens();
      if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
      const retry = await fetch(url, {
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
    throw new ApiError(`api_${res.status}`, res.status, json ?? text);
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
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
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
