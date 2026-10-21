"use client";

import { useTranslation } from "@/lib/i18n";
import { ArrowRightLeft } from "lucide-react";
import styles from "./roll-compare.module.css";

export function RollCompareHeader() {
  const { t } = useTranslation();

  return (
    <header className={styles.heading}>
      <div className={styles.headingIcon}><ArrowRightLeft aria-hidden="true" /></div>
      <div>
        <p>{t("rollCompare.pageEyebrow")}</p>
        <h1>{t("rollCompare.pageTitle")}</h1>
        <span>{t("rollCompare.pageIntro")}</span>
      </div>
    </header>
  );
}
