import { describe, expect, it } from "vitest";

import { nativeGuideData } from "./native-guide-data";
import { nativeRankingData } from "./native-ranking-data";
import { publicCardById, publicCards } from "./public-data";
import { songContextData } from "./song-contexts";

describe("generated native publication data", () => {
  it("covers every real card in each investment lens without an absolute-score claim", () => {
    const expected = publicCards.map((card) => card.id).sort();

    expect(nativeRankingData.absoluteScoreAvailable).toBe(false);
    expect(nativeRankingData.theorycraftBeta).toBe(true);
    for (const lens of nativeRankingData.lenses) {
      expect(lens.entries.map((entry) => entry.cardId).sort()).toEqual(expected);
      expect(lens.entries.map((entry) => entry.rank)).toEqual(
        Array.from({ length: expected.length }, (_, index) => index + 1),
      );
    }
  });

  it("publishes legal exact-anchor formations and a genuinely accessible option", () => {
    const guide = nativeGuideData.guides[0]!;
    const anchor = publicCardById.get(guide.anchorCardId)!;

    expect(anchor.rarity).toBe(5);
    expect(nativeGuideData.rosterCommit).toBe(nativeRankingData.rosterCommit);
    expect(guide.snapshotId).toBe(nativeRankingData.snapshotId);
    expect(guide.benchmark).toMatchObject({
      accountState: "frozen-neutral-public-benchmark",
      platform: "mobile",
      board: { mode: "neutral", relativeContribution: 0 },
      collection: { memberUpgradeBonusPermyriad: 0 },
      eventBonusPermil: 0,
      scoreClaim: "relative-utility-only",
    });
    for (const formation of guide.formations) {
      const cards = formation.members.map((member) => publicCardById.get(member.cardId)!);
      const leader = publicCardById.get(formation.leaderOutfitCardId)!;
      const song = songContextData.songs.find(
        (candidate) => candidate.id === formation.context.songId,
      )!;
      expect(cards).toHaveLength(5);
      expect(new Set(cards.map((card) => card.talentId)).size).toBe(5);
      expect(cards.some((card) => card.id === guide.anchorCardId)).toBe(true);
      expect(formation.ordersAudited).toBe(120);
      expect(formation.orderStatus).toBe("canonical-display-only-timing-unresolved");
      expect(song.scoreRatingEligible).toBe(true);
      expect(song.singerTalentIds).toContain(leader.talentId);
      expect(leader.talentId).toBe(guide.ratingSongScope.singerTalentId);
      expect(formation.activeSkills.every((skill) => skill.chartNoteCoverage === null)).toBe(true);
      expect(formation.specialSkills.every((skill) => skill.chartNoteCoverage === null)).toBe(true);
      expect(
        formation.staticParameters.base.central +
          formation.staticParameters.leaderAndPassiveGain.central,
      ).toBeCloseTo(formation.staticParameters.effective.central, 8);
      expect(
        formation.replacements.every((replacement) => replacement.lossPercent.central >= 0),
      ).toBe(true);
    }

    for (const comparison of guide.ratingSongComparisons) {
      const song = songContextData.songs.find((candidate) => candidate.id === comparison.songId)!;
      const leader = publicCardById.get(comparison.leaderOutfitCardId)!;
      expect(song.scoreRatingEligible).toBe(true);
      expect(song.singerTalentIds).toContain(leader.talentId);
      expect(comparison.platform).toBe("mobile");
      expect(comparison.noteTimeline).toBe("unavailable");
    }

    const accessible = guide.formations.find((formation) => formation.kind === "accessible-4-star")!;
    expect(publicCardById.get(accessible.leaderOutfitCardId)!.rarity).toBe(4);
    expect(
      accessible.members.filter((member) => publicCardById.get(member.cardId)!.rarity === 5),
    ).toHaveLength(1);
  });
});
