"use client";

import { useTranslation } from "@/lib/i18n";
import { Calculator } from "lucide-react";
import styles from "./team-builder.module.css";

interface TeamBuilderHeaderProps {
  readonly totalCards: number;
  readonly totalTalents: number;
}

export function TeamBuilderHeader({ totalCards, totalTalents }: TeamBuilderHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className={styles.heading}>
      <div className={styles.headingIcon}><Calculator aria-hidden="true" /></div>
      <div>
        <p>{t("teamBuilder.eyebrow")}</p>
        <h1>{t("teamBuilder.title")}</h1>
        <span>{t("teamBuilder.intro")}</span>
      </div>
      <dl className={styles.headingStats}>
        <div><dt>{t("teamBuilder.statCards")}</dt><dd>{totalCards}</dd></div>
        <div><dt>{t("teamBuilder.statTalents")}</dt><dd>{totalTalents}</dd></div>
      </dl>
    </header>
  );
}
