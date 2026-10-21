"use client";

import { useTranslation } from "@/lib/i18n";
import { BarChart3 } from "lucide-react";

interface TierListHeaderProps {
  readonly rosterCount: number;
  readonly contextsCount: number;
  readonly lensesCount: number;
}

export function TierListHeader({ rosterCount, contextsCount, lensesCount }: TierListHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="database-heading">
      <div className="database-heading-icon"><BarChart3 aria-hidden="true" /></div>
      <div>
        <p className="db-eyebrow">{t("tierListPage.eyebrow")}</p>
        <h1>{t("tierListPage.title")}</h1>
        <p>{t("tierListPage.intro")}</p>
        <p className="db-heading-note">{t("tierListPage.note")}</p>
      </div>
      <dl className="database-summary">
        <div><dt>{t("tierListPage.statRoster")}</dt><dd>{rosterCount}</dd></div>
        <div><dt>{t("tierListPage.statContexts")}</dt><dd>{contextsCount}</dd></div>
        <div><dt>{t("tierListPage.statLenses")}</dt><dd>{lensesCount}</dd></div>
      </dl>
    </header>
  );
}
