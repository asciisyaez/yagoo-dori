"use client";

import { ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { SiteLink as Link } from "@/components/site-link";
import { TEAM_ROSTER_STORAGE_KEY } from "@/lib/team-roster-storage";

// One-line entry point from a card profile into the roll comparison. Renders
// nothing unless this visitor has a saved roster of six or more cards that
// does NOT include this card — a raw, read-only storage peek so card pages
// ship no calculator code.
export function RollCompareCta({ cardId }: { cardId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(TEAM_ROSTER_STORAGE_KEY);
        if (!raw) return;
        const cards: unknown = JSON.parse(raw)?.cards;
        if (cards === null || typeof cards !== "object") return;
        const ownedIds = Object.keys(cards as Record<string, unknown>);
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
      <Link href={`/roll-compare?card=${cardId}`}>
        See whether this card strengthens your saved team
      </Link>
    </p>
  );
}
