"use client";

import { useTranslation } from "@/lib/i18n";
import { Mic2 } from "lucide-react";

interface TalentsHeaderProps {
  readonly talentCount: number;
  readonly cardCount: number;
  readonly branchCount: number;
}

export function TalentsHeader({ talentCount, cardCount, branchCount }: TalentsHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="database-heading">
      <div className="database-heading-icon"><Mic2 aria-hidden="true" /></div>
      <div>
        <p className="db-eyebrow">{t("talentsPage.eyebrow")}</p>
        <h1>{t("talentsPage.title")}</h1>
        <p>{t("talentsPage.intro")}</p>
      </div>
      <dl className="database-summary">
        <div><dt>{t("talentsPage.statTalents")}</dt><dd>{talentCount}</dd></div>
        <div><dt>{t("talentsPage.statCards")}</dt><dd>{cardCount}</dd></div>
        <div><dt>{t("talentsPage.statBranches")}</dt><dd>{branchCount}</dd></div>
      </dl>
    </header>
  );
}
