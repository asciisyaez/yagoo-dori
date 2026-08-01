import { describe, expect, it } from "vitest";

import {
  DEFAULT_GUIDE_ANCHOR_CARD_ID,
  generateNativeGuideData,
  guideLeaderOutfitCardIdsForSong,
  mergeNativeGuideData,
  rebaseNativeGuideDataSnapshot,
  selectGuideRatingSongs,
} from "./native-guide-generator";
import { nativeGuideData } from "./native-guide-data";
import type { NativeGuide, NativeGuideData } from "./native-guide-schema";
import { nativeRankingData } from "./native-ranking-data";
import { nativeRankingChangelogData } from "./native-ranking-changelog-data";
import { publicCardById } from "./public-data";

const GENERATED_AT = "2026-08-01T05:30:00.000Z";

function guideVariant(anchorCardId: string, label: string): NativeGuide {
  const guide = structuredClone(nativeGuideData.guides[0]!);
  guide.id = `guide-${label}`;
  guide.slug = `guide-${label}`;
  guide.title = `Guide ${label}`;
  guide.anchorCardId = anchorCardId;
  return guide;
}

function guideDataset(...guides: NativeGuide[]): NativeGuideData {
  return {
    schemaVersion: 4,
    generatedAt: GENERATED_AT,
    rosterCommit: nativeRankingData.rosterCommit,
    guides,
  };
}

describe("native guide request resolution", () => {
  it("rejects an anchor that is not one exact 5-star Member card", () => {
    expect(() =>
      generateNativeGuideData("2026-07-31T16:00:00.000Z", {
        anchorCardId: "card-00013-4-cmmn-0000-00",
      }),
    ).toThrow(/exact 5-star/i);
  });

  it("rejects an unknown fixed Leader Outfit before searching", () => {
    expect(() =>
      generateNativeGuideData("2026-07-31T16:00:00.000Z", {
        fixedLeaderOutfitCardId: "missing-outfit",
      }),
    ).toThrow(/unknown fixed Leader/i);
  });

  it("selects only rating-eligible songs that list the guide singer", () => {
    const selection = selectGuideRatingSongs(DEFAULT_GUIDE_ANCHOR_CARD_ID);

    expect(selection.singerTalentId).toBe("chr-00013");
    expect(selection.songs.map((song) => song.id)).toEqual([
      "m0141",
      "m0189",
      "m0164",
      "m0074",
      "m0163",
      "m0303",
    ]);
    expect(
      selection.songs.every(
        (song) =>
          song.scoreRatingEligible && song.singerTalentIds.includes(selection.singerTalentId),
      ),
    ).toBe(true);
  });

  it("constrains every song search to Leader Outfits for its declared singer", () => {
    const selection = selectGuideRatingSongs(
      DEFAULT_GUIDE_ANCHOR_CARD_ID,
      "card-00039-5-uniq-0032-00",
    );
    expect(selection.singerTalentId).toBe("chr-00039");
    expect(selection.songs.map((song) => song.id)).toEqual([
      "m0155",
      "m0105",
      "m0046",
      "m0164",
    ]);

    for (const song of selection.songs) {
      const leaderIds = guideLeaderOutfitCardIdsForSong(song.id, selection.singerTalentId);
      expect(leaderIds.length).toBeGreaterThan(0);
      expect(
        leaderIds.every(
          (cardId) => publicCardById.get(cardId)?.talentId === selection.singerTalentId,
        ),
      ).toBe(true);
    }
  });
});

describe("native guide dataset merge", () => {
  it("rebases guides only across a score- and rank-neutral ranking transition", () => {
    const stale = structuredClone(nativeGuideData);
    for (const guide of stale.guides) {
      guide.snapshotId = nativeRankingChangelogData.from!.snapshotId;
    }
    const rebased = rebaseNativeGuideDataSnapshot(
      GENERATED_AT,
      stale,
      nativeRankingChangelogData,
    );
    expect(new Set(rebased.guides.map((guide) => guide.snapshotId))).toEqual(
      new Set([nativeRankingData.snapshotId]),
    );

    expect(() => rebaseNativeGuideDataSnapshot(GENERATED_AT, stale, {
      ...nativeRankingChangelogData,
      summary: { ...nativeRankingChangelogData.summary, scoreChanged: 1 },
    })).toThrow(/unchanged roster, score index, and rank order/i);
  });

  it("preserves unrelated guides and replaces the matching anchor", () => {
    const oldAnchor = guideVariant("anchor-a", "old-a");
    const unrelated = guideVariant("anchor-b", "b");
    const replacement = guideVariant("anchor-a", "new-a");

    const merged = mergeNativeGuideData(
      GENERATED_AT,
      [guideDataset(replacement)],
      guideDataset(oldAnchor, unrelated),
    );

    expect(merged.guides.map((guide) => guide.id)).toEqual(["guide-new-a", "guide-b"]);
  });

  it("is idempotent and sorts independently of generation order", () => {
    const guideA = guideVariant("anchor-a", "a");
    const guideB = guideVariant("anchor-b", "b");
    const forward = mergeNativeGuideData(GENERATED_AT, [guideDataset(guideA), guideDataset(guideB)]);
    const reverse = mergeNativeGuideData(GENERATED_AT, [guideDataset(guideB), guideDataset(guideA)]);
    const repeated = mergeNativeGuideData(GENERATED_AT, [guideDataset(guideB), guideDataset(guideA)], forward);

    expect(reverse).toEqual(forward);
    expect(repeated).toEqual(forward);
  });

  it("rejects retained guides from stale roster or ranking snapshots", () => {
    const current = guideDataset(guideVariant("anchor-a", "a"));
    const staleRoster = structuredClone(current);
    staleRoster.rosterCommit = "0".repeat(40);
    const staleRanking = structuredClone(current);
    staleRanking.guides[0]!.snapshotId = "stale-ranking";

    expect(() => mergeNativeGuideData(GENERATED_AT, [current], staleRoster)).toThrow(/stale roster/i);
    expect(() => mergeNativeGuideData(GENERATED_AT, [current], staleRanking)).toThrow(/stale ranking/i);
  });
});
