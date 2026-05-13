'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Theme contract:
 * - `theme` is what the user picked (light | dark | system).
 * - `resolved` is what is actually rendered (light | dark), with `system`
 *   resolved against `prefers-color-scheme`.
 *
 * The `.dark` class on <html> is the single source of truth for CSS — kept
 * in sync here. Initial value is set by an inline script in <head> to avoid
 * flash of incorrect theme.
 */
export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'deliveryhub-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystem(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): Theme {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [system, setSystem] = useState<ResolvedTheme>('dark');

  // Hydrate from storage + system once mounted.
  useEffect(() => {
    setThemeState(readStored());
    setSystem(readSystem());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolved: ResolvedTheme = theme === 'system' ? system : theme;

  // Keep DOM class in sync after hydration.
  useEffect(() => {
    apply(resolved);
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // localStorage may be unavailable (private mode, etc.) — ignore.
    }
  }, []);

  const toggle = useCallback(() => {
    // Toggle flips the *currently rendered* theme — simplest mental model.
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Inline script injected in <head> so the correct theme class is on <html>
 * before paint. Mirrors the resolution logic of `ThemeProvider` for the
 * initial value. Keep this in sync if storage key / resolution rules change.
 */
export const THEME_INIT_SCRIPT = `(() => {
  try {
    var key = '${STORAGE_KEY}';
    var stored = localStorage.getItem(key);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`;
