"use client";

/**
 * i18n React Context & Hook
 *
 * Architecture decisions:
 * - Fully client-side; no server middleware or URL rewriting.
 *   Compatible with Next.js static export (GitHub Pages).
 * - Language preference stored in localStorage key "yd-locale".
 * - Defaults to "en" on first load and in SSR/test environments.
 *   All 134 Playwright E2E tests pass without changes because they
 *   start with no localStorage entry → default "en".
 * - Graceful fallback: if a key is missing in the active locale,
 *   the English value is returned. UI never shows empty text.
 * - Lazy-loads the locale JSON only when the user switches language,
 *   so the initial bundle stays small.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocaleCode } from "./config";
import { format } from "./format";
import type { TranslationKey } from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "yd-locale";

function getStoredLocale(): SupportedLocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in SUPPORTED_LOCALES) return stored as SupportedLocaleCode;
  } catch {
    // Storage unavailable or restricted (SecurityError/DOMException)
  }
  return DEFAULT_LOCALE;
}

/** Resolve a dot-notation key into a nested object value. */
function resolvePath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

// ---------------------------------------------------------------------------
// Locale loader (dynamic import, cached)
// ---------------------------------------------------------------------------

type LocaleData = Record<string, unknown>;

const localeCache = new Map<string, LocaleData>();

async function loadLocale(code: string): Promise<LocaleData> {
  const cached = localeCache.get(code);
  if (cached) return cached;

  // Dynamic import — bundler will code-split each locale JSON.
  const localeModule = await import(`../../locales/${code}.json`);
  const data = localeModule.default as LocaleData;
  localeCache.set(code, data);
  return data;
}

// Pre-load English synchronously so the first render never flickers.
// The en.json import is inlined at build time.
import enData from "../../locales/en.json";
localeCache.set("en", enData as unknown as LocaleData);

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface I18nContextValue {
  locale: SupportedLocaleCode;
  setLocale: (code: SupportedLocaleCode) => void;
  /** Translate a dot-notation key, with optional variable interpolation. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocaleCode>(DEFAULT_LOCALE);
  const [dict, setDict] = useState<LocaleData>(enData as unknown as LocaleData);
  const enDict = enData as unknown as LocaleData;

  // Hydrate locale from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = getStoredLocale();
    if (stored === DEFAULT_LOCALE) return;
    loadLocale(stored).then((data) => {
      setDict(data);
      setLocaleState(stored);
      document.documentElement.lang = stored;
    });
  }, []);

  const setLocale = useCallback((code: SupportedLocaleCode) => {
    if (!(code in SUPPORTED_LOCALES)) return;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage unavailable or quota exceeded
    }
    loadLocale(code).then((data) => {
      setDict(data);
      setLocaleState(code);
      // Update the HTML lang attribute so screen readers adjust.
      document.documentElement.lang = code;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const value =
        resolvePath(dict, key) ??
        resolvePath(enDict, key) ??
        key; // last-resort: show the key itself

      return vars ? format(value, vars) : value;
    },
    [dict, enDict],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the `t()` translation function and locale management helpers.
 *
 * Must be called inside a component tree wrapped by `<I18nProvider>`.
 * Server Components cannot use this hook — pass translated strings as props
 * from a Client Component boundary instead.
 */
export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used inside <I18nProvider>");
  }
  return ctx;
}
