import { describe, expect, it } from "vitest";
import { currentBanner } from "./current-banner";
import { publicCards } from "./public-data";

describe("current banner metadata", () => {
  it("joins all five live banner Members to the verified roster", () => {
    expect(currentBanner.status).toBe("live");
    expect(currentBanner.featuredCardIds).toHaveLength(5);
    expect(currentBanner.featuredCardIds.every((id) => publicCards.some((card) => card.id === id))).toBe(true);
    expect(new Set(currentBanner.featuredCardIds).size).toBe(5);
    expect(currentBanner.featuredCardIds.every((id) => {
      const card = publicCards.find((candidate) => candidate.id === id);
      return card?.rarity === 5 && card.firstSeenAt === currentBanner.retrievedAt;
    })).toBe(true);
    expect(currentBanner.announcedMembers).toHaveLength(0);
  });
  it("records the live gacha, verified spotlight schedule and end dates", () => {
    expect(currentBanner.eventName).toBe("Whistling Wind Walk");
    expect(currentBanner.gachaNameEn).toBe("Bright Autumn Trip Gacha");
    expect(currentBanner.gachaNameJa).toBe("うららかな秋にお出かけを♪");
    expect(currentBanner.eventType).toBe("spotlight");
    expect(currentBanner.startsAt).toBe("2026-11-14T02:00:00.000Z");
    expect(currentBanner.endsAt).toBe("2026-11-26T01:59:00.000Z");
    expect(currentBanner.eventStartsAt).toBe("2026-11-14T11:00:00.000Z");
    expect(currentBanner.eventEndsAt).toBe("2026-11-24T10:59:00.000Z");
    expect(currentBanner.eventTracks.map(({ talent, songId, title, startsAt, endsAt }) => ({ talent, songId, title, startsAt, endsAt }))).toEqual([
      { talent: "Robocosan", songId: "m0383", title: "slight fever", startsAt: "2026-11-14T11:00:00.000Z", endsAt: "2026-11-16T10:59:00.000Z" },
      { talent: "Usada Pekora", songId: "m0387", title: "PEKORISER", startsAt: "2026-11-16T11:00:00.000Z", endsAt: "2026-11-18T10:59:00.000Z" },
      { talent: "IRyS", songId: "m0385", title: "Burning hope", startsAt: "2026-11-18T11:00:00.000Z", endsAt: "2026-11-20T10:59:00.000Z" },
      { talent: "Momosuzu Nene", songId: "m0384", title: "Dear You, A Love Song Just for You!", startsAt: "2026-11-20T11:00:00.000Z", endsAt: "2026-11-22T10:59:00.000Z" },
      { talent: "Pavolia Reine", songId: "m0386", title: "Halulu", startsAt: "2026-11-22T11:00:00.000Z", endsAt: "2026-11-24T10:59:00.000Z" },
    ]);
  });
});
