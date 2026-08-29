import { describe, expect, it } from "vitest";

import { currentBanner } from "./current-banner";
import { publicCardById } from "./public-data";
import { songContextData } from "./song-contexts";

describe("current banner metadata", () => {
  it("links the live banner to four current five-star cards", () => {
    expect(currentBanner.status).toBe("live");
    expect(currentBanner.featuredCardIds.every((cardId) => {
      const card = publicCardById.get(cardId);
      return card?.rarity === 5 && card.firstSeenAt === currentBanner.retrievedAt;
    })).toBe(true);
    expect(new Set(currentBanner.featuredCardIds).size).toBe(4);
  });

  it("links all five event songs to the pinned song catalog", () => {
    const songs = new Map(songContextData.songs.map((song) => [song.id, song]));
    expect(currentBanner.eventSongIds.every((songId) => songs.has(songId))).toBe(true);
    expect(new Set(currentBanner.eventSongIds).size).toBe(5);
  });
});
