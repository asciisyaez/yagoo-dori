import type { StoredOshiPreference } from "@/lib/team-roster-storage";

export function formatUtility(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatSignedUtility(value: number): string {
  if (Math.abs(value) < 0.5) return "0";
  return `${value > 0 ? "+" : "−"}${formatUtility(Math.abs(value))}`;
}

export function formatSignedPercent(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.05) return "Near tie (<0.05%)";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

export function normalizeRequiredMemberCardIds<Card extends { talentId: string }>(
  cardIds: readonly string[],
  cardById: ReadonlyMap<string, Card>,
  ownedCardIds: ReadonlySet<string>,
): string[] {
  const selectedTalentIds = new Set<string>();
  return [...new Set(cardIds)]
    .filter((cardId) => ownedCardIds.has(cardId) && cardById.has(cardId))
    .sort()
    .filter((cardId) => {
      const talentId = cardById.get(cardId)!.talentId;
      if (selectedTalentIds.has(talentId)) return false;
      selectedTalentIds.add(talentId);
      return true;
    })
    .slice(0, 5);
}

export function savedOshiStillOwned(
  oshi: Pick<StoredOshiPreference, "talentId">,
  ownedCardIds: ReadonlySet<string>,
  cardById: ReadonlyMap<string, { talentId: string }>,
): boolean {
  if (oshi.talentId === null) return true;
  for (const cardId of ownedCardIds) {
    if (cardById.get(cardId)?.talentId === oshi.talentId) return true;
  }
  return false;
}
