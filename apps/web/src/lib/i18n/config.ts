/**
 * i18n Locale Registry
 *
 * Add a new entry to SUPPORTED_LOCALES to register a new language.
 * That is the only file change required in the framework itself when
 * a contributor adds a new locale JSON file.
 */

export interface LocaleMeta {
  /** BCP-47 language code (e.g. "en", "vi", "ja") */
  code: string;
  /** English display name */
  name: string;
  /** Native display name shown in the language switcher */
  nativeName: string;
}

/**
 * Registry of all supported locales.
 * Key must match the JSON filename in `apps/web/src/locales/`.
 *
 * CONTRIBUTING A NEW LOCALE
 * -------------------------
 * 1. Create `apps/web/src/locales/<code>.json`.
 * 2. Add an entry here: `<code>: { code, name, nativeName }`.
 * 3. Run `pnpm i18n:check` to verify completeness.
 */
export const SUPPORTED_LOCALES: Record<string, LocaleMeta> = {
  en: { code: "en", name: "English", nativeName: "English" },
  vi: { code: "vi", name: "Vietnamese (Preview)", nativeName: "Tiếng Việt (Thử nghiệm)" },
  // Add more locales here — no other files need to change.
  // Example:
  // ja: { code: "ja", name: "Japanese", nativeName: "日本語" },
  // id: { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
} as const;

export const DEFAULT_LOCALE = "en" as const;

export type SupportedLocaleCode = keyof typeof SUPPORTED_LOCALES;
