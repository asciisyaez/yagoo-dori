import { describe, expect, it } from "vitest";

import { currentBanner } from "./current-banner";
import { publicCards } from "./public-data";

describe("current banner metadata", () => {
  it("joins every banner Member to a verified numerical card record", () => {
    expect(currentBanner.status).toBe("live");
    expect(currentBanner.featuredCardIds).toHaveLength(4);
    expect(currentBanner.featuredCardIds.every((id) => publicCards.some((card) => card.id === id))).toBe(true);
    expect(currentBanner.announcedMembers).toHaveLength(0);
  });

  it("preserves chapter windows and explicitly joined song IDs", () => {
    expect(currentBanner.eventType).toBe("spotlight");
    expect(currentBanner.eventTracks.map((track) => track.title)).toEqual([
      "Shallow Shadow", "Forge My Soul", "Amaryllis", "CORE//UNBREAKABLE",
    ]);
    expect(currentBanner.eventTracks.map((track) => track.songId)).toEqual(["m0365", "m0368", "m0366", "m0367"]);
    expect(currentBanner.startsAt).toBe("2026-10-19T02:00:00.000Z");
    expect(currentBanner.endsAt).toBe("2026-10-29T01:59:00.000Z");
    expect(currentBanner.eventTracks[0]?.startsAt).toBe(currentBanner.eventStartsAt);
    expect(currentBanner.eventTracks.at(-1)?.endsAt).toBe(currentBanner.eventEndsAt);
    for (let index = 0; index < currentBanner.eventTracks.length; index += 1) {
      const chapter = currentBanner.eventTracks[index]!;
      expect(Date.parse(chapter.endsAt) - Date.parse(chapter.startsAt)).toBe(48 * 60 * 60 * 1000 - 60 * 1000);
      const next = currentBanner.eventTracks[index + 1];
      if (next) expect(Date.parse(next.startsAt) - Date.parse(chapter.endsAt)).toBe(60 * 1000);
    }
  });
});
