import { publicTalents } from "@yagoo-dori/core";

export function talentSlug(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const talentRecords = publicTalents.map((talent) => ({
  ...talent,
  slug: talentSlug(talent.name),
  heroCard: talent.cards.find((card) => card.rarity === 5) ?? talent.cards[0]!,
}));

export const talentRecordBySlug = new Map(talentRecords.map((talent) => [talent.slug, talent]));
