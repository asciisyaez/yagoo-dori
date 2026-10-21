"use client";

import { ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
import { readOwnedCardIds } from "@/lib/team-roster-storage";

// One-line entry point from a card profile into the roll comparison. Renders
// nothing unless this visitor has a saved roster of six or more cards that
// does NOT include this card — the >=6 count is a cheap heuristic, and the
// target page owns the real legality gate. This is a raw, read-only storage
// peek so card pages ship no calculator code.
export function RollCompareCta({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try {
        const ownedIds = readOwnedCardIds(window.localStorage);
        setVisible(ownedIds.length >= 6 && !ownedIds.includes(cardId));
      } catch {
        // No roster readable: the card page simply stays as it is.
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [cardId]);

  if (!visible) return null;
  return (
    <p className="db-heading-note">
      <ArrowRightLeft aria-hidden="true" size={13} />{" "}
      <Link className="cursor-pointer" href={`/roll-compare?card=${cardId}`}>
        {t("rollCompare.seeIfStrengthens")}
      </Link>
    </p>
  );
}
