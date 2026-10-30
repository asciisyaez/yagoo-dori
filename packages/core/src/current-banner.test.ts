import { describe, expect, it } from "vitest";
import { currentBanner } from "./current-banner";
import { publicCards } from "./public-data";

describe("current banner metadata", () => {
  it("joins all five Halloween Members to the verified roster", () => {
    expect(currentBanner.status).toBe("live");
    expect(currentBanner.featuredCardIds).toHaveLength(5);
    expect(currentBanner.featuredCardIds.every((id) => publicCards.some((card) => card.id === id))).toBe(true);
    expect(currentBanner.announcedMembers).toHaveLength(0);
  });
  it("records the published point rally, gacha dates, and six event songs", () => {
    expect(currentBanner.eventType).toBe("point-rally");
    expect(currentBanner.startsAt).toBe("2026-10-29T02:00:00.000Z");
    expect(currentBanner.endsAt).toBe("2026-11-06T01:59:00.000Z");
    expect(currentBanner.eventStartsAt).toBe("2026-10-29T03:00:00.000Z");
    expect(currentBanner.eventEndsAt).toBe("2026-11-04T10:59:00.000Z");
    expect(currentBanner.eventTracks.map((track) => track.songId)).toEqual(["m0369", "m0551", "m0388", "m0373", "m0372", "m0371"]);
    expect(currentBanner.eventTracks.every((track) => track.startsAt === null && track.endsAt === null)).toBe(true);
  });
});
