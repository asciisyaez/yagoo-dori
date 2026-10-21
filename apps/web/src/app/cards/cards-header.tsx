"use client";

import { useTranslation } from "@/lib/i18n";
import { LibraryBig } from "lucide-react";

interface CardsHeaderProps {
  readonly total: number;
  readonly fiveStar: number;
  readonly fourStar: number;
}

export function CardsHeader({ total, fiveStar, fourStar }: CardsHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="database-heading">
      <div className="database-heading-icon"><LibraryBig aria-hidden="true" /></div>
      <div>
        <p className="db-eyebrow">{t("cardsPage.eyebrow")}</p>
        <h1>{t("cardsPage.title")}</h1>
        <p>{t("cardsPage.intro")}</p>
      </div>
      <dl className="database-summary">
        <div><dt>{t("cardsPage.statTotal")}</dt><dd>{total}</dd></div>
        <div><dt>{t("cardsPage.statFiveStar")}</dt><dd>{fiveStar}</dd></div>
        <div><dt>{t("cardsPage.statFourStar")}</dt><dd>{fourStar}</dd></div>
      </dl>
    </header>
  );
}
