import { describe, expect, it } from "vitest";

import { currentBanner } from "./current-banner";
import { publicCardById } from "./public-data";

describe("current banner metadata", () => {
  it("links the live banner to four current five-star cards", () => {
    expect(currentBanner.status).toBe("live");
    expect(currentBanner.featuredCardIds.every((cardId) => {
      const card = publicCardById.get(cardId);
      return card?.rarity === 5 && card.firstSeenAt === currentBanner.retrievedAt;
    })).toBe(true);
    expect(new Set(currentBanner.featuredCardIds).size).toBe(3);
  });

  it("lists the three newly released event tracks without implying complete chart coverage", () => {
    expect(currentBanner.eventTracks.map((track) => track.title)).toEqual([
      "HOLOGRAM CIRCUS",
      "Lamy's Baribari Workout",
      "Tokyo Shandy Rendez-vous",
    ]);
    expect(new Set(currentBanner.eventTracks.map((track) => track.songId)).size).toBe(3);
  });
});
