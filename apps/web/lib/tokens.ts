const ACCESS_KEY = 'dh:access';
const REFRESH_KEY = 'dh:refresh';

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

export function readTokens(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const access = window.localStorage.getItem(ACCESS_KEY);
  const refresh = window.localStorage.getItem(REFRESH_KEY);
  if (!access || !refresh) return null;
  return { accessToken: access, refreshToken: refresh };
}

export function writeTokens(auth: StoredAuth): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, auth.accessToken);
  window.localStorage.setItem(REFRESH_KEY, auth.refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
