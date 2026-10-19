import { describe, expect, it } from "vitest";

import { currentBanner } from "./current-banner";
import { publicCards, publicTalents } from "./public-data";

describe("current banner metadata", () => {
  it("keeps announced Members separate from verified numerical card records", () => {
    expect(currentBanner.status).toBe("live");
    expect(currentBanner.featuredCardIds).toEqual([]);
    expect(currentBanner.announcedMembers).toHaveLength(4);
    for (const member of currentBanner.announcedMembers) {
      expect(publicTalents.some((talent) => talent.id === member.talentId && talent.name === member.talentName)).toBe(true);
      expect(publicCards.some((card) => card.talentId === member.talentId && card.titleJa === member.titleJa)).toBe(false);
    }
  });

  it("preserves chapter windows and song names without inventing song IDs", () => {
    expect(currentBanner.eventType).toBe("spotlight");
    expect(currentBanner.eventTracks.map((track) => track.title)).toEqual([
      "Shallow Shadow", "Forge My Soul", "アマリリス", "CORE//UNBREAKABLE",
    ]);
    expect(currentBanner.eventTracks.every((track) => track.songId === null)).toBe(true);
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
