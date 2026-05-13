'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from './api.js';
import { r } from './routes.js';
import { clearTokens, readTokens, writeTokens } from './tokens.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
}

export interface AuthState {
  user: AuthUser;
  organization: AuthOrganization;
  role: string;
  storeId?: string | null;
}

interface AuthResultDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  organization: AuthOrganization;
  role: string;
}

interface MeDto {
  user: AuthUser & { createdAt: string };
  orgId: string;
  role: string;
  stores: { id: string; name: string }[];
}

interface AuthContextValue {
  state: AuthState | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  // bootstrap: se tem token salvo, valida via /api/me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = readTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }
      try {
        const me = await api<MeDto>('/me');
        if (cancelled) return;
        setState({
          user: { ...me.user },
          organization: { id: me.orgId, name: '' }, // /me não devolve nome ainda
          role: me.role,
          storeId: me.stores[0]?.id ?? null,
        });
      } catch {
        clearTokens();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finalize = (data: AuthResultDto, firstStoreId?: string | null) => {
    writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setState({
      user: data.user,
      organization: data.organization,
      role: data.role,
      storeId: firstStoreId ?? null,
    });
  };

  const login = async (email: string, password: string) => {
    const data = await api<AuthResultDto>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    // Após login, pega lojas via /me para guardar o storeId default.
    finalize(data);
    try {
      const me = await api<MeDto>('/me');
      setState((s) => (s ? { ...s, storeId: me.stores[0]?.id ?? null } : s));
    } catch {
      // se /me falhar agora, o usuário pode recarregar; não fatal
    }
    router.push(r('/hub'));
  };

  const signup = async (input: Parameters<AuthContextValue['signup']>[0]) => {
    const data = await api<AuthResultDto>('/auth/signup', {
      method: 'POST',
      body: input,
      skipAuth: true,
    });
    finalize(data);
    router.push(r('/hub'));
  };

  const logout = async () => {
    const tokens = readTokens();
    if (tokens) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: { refreshToken: tokens.refreshToken },
          skipAuth: true,
        });
      } catch {
        // ignora — local cleanup acontece sempre
      }
    }
    clearTokens();
    setState(null);
    router.push(r('/login'));
  };

  return (
    <AuthContext.Provider value={{ state, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
