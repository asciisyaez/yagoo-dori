import { describe, expect, it } from "vitest";

import { publicCardBySlug, publicCards, publicData, publicTalents } from "./public-data";

const AZKI_CARD_SLUG = "azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00";

describe("pinned public hololive Dreams dataset", () => {
  it("contains the complete current four-star and five-star roster", () => {
    expect(publicData.counts).toEqual({
      talents: 54,
      fourStar: 54,
      fiveStar: 59,
      total: 113,
      art: 113,
    });
    expect(publicCards).toHaveLength(113);
    expect(publicTalents).toHaveLength(54);
    expect(new Set(publicCards.map((card) => card.id)).size).toBe(113);
    expect(new Set(publicCards.map((card) => card.slug)).size).toBe(113);
    expect(publicCards.filter((card) => card.rarity === 4)).toHaveLength(54);
    expect(publicCards.filter((card) => card.rarity === 5)).toHaveLength(59);
  });

  it("keeps the attributed editorial tier snapshot separate from four-star records", () => {
    const fiveStar = publicCards.filter((card) => card.rarity === 5);
    const fourStar = publicCards.filter((card) => card.rarity === 4);

    expect(fiveStar.filter((card) => card.editorialTier === "SS")).toHaveLength(10);
    expect(fiveStar.filter((card) => card.editorialTier === "S")).toHaveLength(23);
    expect(fiveStar.filter((card) => card.editorialTier === "A")).toHaveLength(26);
    expect(fourStar.every((card) => card.editorialTier === null)).toBe(true);
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
