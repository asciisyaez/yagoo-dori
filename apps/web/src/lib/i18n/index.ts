/**
 * Public exports for the i18n module.
 *
 * Import from "@/lib/i18n" in application code.
 */

export { I18nProvider, useTranslation } from "./context";
export { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./config";
export type { LocaleMeta, SupportedLocaleCode } from "./config";
export type { Dictionary, TranslationKey } from "./types";
export { format, pluralKey } from "./format";
