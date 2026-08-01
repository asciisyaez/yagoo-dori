import { describe, expect, it } from "vitest";

import {
  nativeLeaderOutfitRankingEntryByLensAndCard,
  nativeLeaderOutfitRankingLensById,
  nativeMemberRankingLensById,
  nativeRankingData,
  nativeRankingEntryByLensAndCard,
  nativeRankingLensById,
} from "./native-ranking-data";
import { nativeCompetitionRanks, type NativeLens } from "./native-ranking-schema";
import { publicCards } from "./public-data";

const lenses = [
  "low-investment",
  "one-copy-maximum",
  "duplicate-enabled-ceiling",
] as const satisfies readonly NativeLens[];

describe("native ranking publication lookups", () => {
  it("keeps explicit Member and Leader/Outfit lens maps unambiguous", () => {
    expect(nativeRankingLensById).toBe(nativeMemberRankingLensById);
    for (const lens of lenses) {
      expect(nativeMemberRankingLensById.get(lens)?.entityKind).toBe("member");
      expect(nativeLeaderOutfitRankingLensById.get(lens)?.entityKind).toBe(
        "leader-outfit",
      );
    }
  });

  it("resolves every public card independently in both ranking contexts", () => {
    for (const lens of lenses) {
      const memberEntries = nativeRankingEntryByLensAndCard.get(lens)!;
      const leaderEntries = nativeLeaderOutfitRankingEntryByLensAndCard.get(lens)!;
      expect(memberEntries.size).toBe(publicCards.length);
      expect(leaderEntries.size).toBe(publicCards.length);
      for (const card of publicCards) {
        expect(memberEntries.get(card.id)?.cardId).toBe(card.id);
        expect(leaderEntries.get(card.id)?.cardId).toBe(card.id);
      }
    }
  });

  it("publishes descending competition ranks and equal statistics for exact ties", () => {
    for (const snapshot of [...nativeRankingData.lenses, ...nativeRankingData.leaderOutfitLenses]) {
      const expectedRanks = nativeCompetitionRanks(
        snapshot.entries.map((entry) => entry.index.central),
      );
      expect(snapshot.entries.map((entry) => entry.rank)).toEqual(expectedRanks);

      const tied = new Map<number, typeof snapshot.entries>();
      for (const entry of snapshot.entries) {
        const entries = tied.get(entry.index.central) ?? [];
        tied.set(entry.index.central, [...entries, entry]);
      }
      for (const entries of tied.values()) {
        if (entries.length < 2) continue;
        expect(new Set(entries.map((entry) => entry.rank)).size).toBe(1);
        expect(
          new Set(entries.map((entry) => entry.bootstrap.probabilityTopDecilePermil)).size,
        ).toBe(1);
      }
    }
  });
});
