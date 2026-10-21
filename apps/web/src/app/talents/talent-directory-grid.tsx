"use client";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
import type { TalentRecord } from "./talent-records";

interface TalentDirectoryGridProps {
  readonly talents: readonly TalentRecord[];
}

export function TalentDirectoryGrid({ talents }: TalentDirectoryGridProps) {
  const { t } = useTranslation();

  return (
    <div className="talent-directory-grid">
      {talents.map((talent) => (
        <Link
          className={`talent-directory-card cursor-pointer attribute-${talent.heroCard.attribute}`}
          href={`/talents/${talent.slug}`}
          key={talent.id}
        >
          <span className="talent-directory-art">
            <Image
              alt=""
              fill
              preview
              sizes="(max-width: 640px) 48vw, (max-width: 1200px) 25vw, 190px"
              src={talent.heroCard.illustrationPath}
            />
          </span>
          <span className="talent-directory-copy">
            <small>{talent.branch} · {talent.groups.join(" + ")}</small>
            <strong>{talent.name}</strong>
            <span>
              {t("talentsPage.cardsAndOutfits", {
                cards: talent.cards.length,
                outfits: talent.cards.length,
              })}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
