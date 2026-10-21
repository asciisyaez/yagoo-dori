"use client";

/**
 * I18nProviderWrapper
 *
 * A thin Client Component that wraps the I18nProvider around the app.
 * Necessary because Next.js App Router layouts are Server Components by
 * default, and the I18nProvider relies on React context + localStorage.
 */

import { I18nProvider } from "@/lib/i18n";
import type { ReactNode } from "react";

export function I18nProviderWrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
