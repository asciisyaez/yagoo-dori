"use client";

/**
 * Language Switcher Dropdown
 *
 * A compact, accessible dropdown that lets the user switch between
 * supported locales. Dynamically renders all locales registered in
 * SUPPORTED_LOCALES, making it 100% generic for any future community additions.
 *
 * Design rules (per project constraints):
 *  - Semantic <select> with <label> and screen-reader accessibility.
 *  - cursor-pointer on interactive elements.
 *  - Subtle hover transition (transition-colors duration-200).
 *  - Zero complex animations.
 */

import { SUPPORTED_LOCALES, useTranslation } from "@/lib/i18n";
import type { SupportedLocaleCode } from "@/lib/i18n";
import { Globe, ChevronDown } from "lucide-react";
import type { ChangeEvent } from "react";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as SupportedLocaleCode);
  };

  return (
    <div className="language-switcher">
      <label className="language-switcher-control cursor-pointer" htmlFor="yd-language-select">
        <Globe aria-hidden="true" className="language-switcher-icon" size={14} />
        <span className="sr-only">{t("nav.language")}</span>
        <select
          aria-label={t("nav.language")}
          className="language-switcher-select cursor-pointer transition-colors duration-200"
          id="yd-language-select"
          onChange={handleChange}
          value={locale}
        >
          {Object.values(SUPPORTED_LOCALES).map((meta) => (
            <option key={meta.code} value={meta.code} lang={meta.code}>
              {meta.nativeName}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="language-switcher-chevron" size={14} />
      </label>
    </div>
  );
}
