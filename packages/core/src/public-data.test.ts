import { describe, expect, it } from "vitest";

import {
  PublicDataSchema,
  publicCardBySlug,
  publicCards,
  publicData,
  publicTalents,
} from "./public-data";

const AZKI_CARD_SLUG = "azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00";

describe("pinned public hololive Dreams dataset", () => {
  it("contains the complete current four-star and five-star roster", () => {
    expect(publicData.counts).toEqual({
      talents: 54,
      fourStar: 54,
      fiveStar: 61,
      total: 115,
      art: 115,
    });
    expect(publicCards).toHaveLength(115);
    expect(publicTalents).toHaveLength(54);
    expect(new Set(publicCards.map((card) => card.id)).size).toBe(115);
    expect(new Set(publicCards.map((card) => card.slug)).size).toBe(115);
    expect(publicCards.filter((card) => card.rarity === 4)).toHaveLength(54);
    expect(publicCards.filter((card) => card.rarity === 5)).toHaveLength(61);
  });

  it("validates declared counts instead of hard-coding the launch roster size", () => {
    const expanded = structuredClone(publicData);
    const source = expanded.cards[0]!;
    expanded.cards.push({
      ...source,
      id: "card-future-5-uniq-9999-00",
      slug: "future-talent-future-card-card-future-5-uniq-9999-00",
      talentId: "future-talent",
      talentName: "Future Talent",
      assetId: "future-card-art",
      artPath: "/game/cards/card-future-5-uniq-9999-00.webp",
      illustrationPath: "/game/illustrations/card-future-5-uniq-9999-00.webp",
    });
    expanded.counts.talents += 1;
    expanded.counts.fiveStar += 1;
    expanded.counts.total += 1;
    expanded.counts.art += 1;

    expect(PublicDataSchema.safeParse(expanded).success).toBe(true);
    expanded.counts.total -= 1;
    expect(PublicDataSchema.safeParse(expanded).success).toBe(false);
  });

  it("excludes editorial tier labels and rejects them if reintroduced", () => {
    expect("editorialTier" in publicData.sourceSnapshots).toBe(false);
    expect(publicCards.every((card) => !("editorialTier" in card))).toBe(true);
    expect(publicData.notes.every((note) => !/editorial|tier snapshot/i.test(note))).toBe(true);

    const withCardTier = structuredClone(publicData) as unknown as Record<string, unknown>;
    const cards = withCardTier.cards as Array<Record<string, unknown>>;
    cards[0]!.editorialTier = "SS";
    expect(PublicDataSchema.safeParse(withCardTier).success).toBe(false);

    const withTierSource = structuredClone(publicData) as unknown as Record<string, unknown>;
    const sources = withTierSource.sourceSnapshots as Record<string, unknown>;
    sources.editorialTier = { page: "https://example.com", label: "tier snapshot" };
    expect(PublicDataSchema.safeParse(withTierSource).success).toBe(false);
  });

  it("preserves many-to-many talent group membership", () => {
    const fubuki = publicCards.find((card) => card.talentName === "Shirakami Fubuki");
    expect(fubuki?.groups).toEqual(["GAMERS", "Gen 1"]);
  });

  it("joins AZKi's real stats, skills, Outfit, and local artwork paths", () => {
    const azki = publicCardBySlug.get(AZKI_CARD_SLUG);

    expect(azki).toBeDefined();
    expect(azki).toMatchObject({
      talentName: "AZKi",
      title: "A Flower in Full Bloom",
      rarity: 5,
      attribute: "pure",
      groups: ["Gen 0"],
      artPath: "/game/cards/card-00013-5-uniq-0002-00.webp",
      illustrationPath: "/game/illustrations/card-00013-5-uniq-0002-00.webp",
      parameters: {
        oneCopyMaxLevel: { performance: 6184, technique: 6984, sense: 10346 },
        maxPotential: { performance: 6803, technique: 7682, sense: 11380 },
      },
      leaderOutfit: {
        costumeName: "Graceful Scent",
        description: "Grants Sense UP 120% to all.",
      },
    });
    expect(azki?.skills.active.at(-1)).toMatchObject({
      cooldownSeconds: 20,
      durationSeconds: 7,
      activationProbability: 0.55,
    });
    expect(azki?.skills.passive.at(-1)?.description).toBe(
      "Grants Sense UP 43% to 2 Gen 0 Members.",
    );
    expect(azki?.skills.special.at(-1)).toMatchObject({ durationSeconds: 10 });
  });
});
