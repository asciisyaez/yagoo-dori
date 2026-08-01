import { describe, expect, it } from "vitest";

import {
  nativeGuideByAnchorCardId,
  nativeGuideBySlug,
  nativeGuideData,
} from "./native-guide-data";
import { nativeRankingData } from "./native-ranking-data";
import { publicCardById, publicCards } from "./public-data";
import { songContextData } from "./song-contexts";

const EXPECTED_GUIDE_ANCHOR_CARD_IDS = [
  "card-00012-5-uniq-0062-00",
  "card-00013-5-uniq-0002-00",
  "card-00019-5-uniq-0016-00",
  "card-00021-5-uniq-0064-00",
  "card-00022-5-uniq-0063-00",
  "card-00026-5-uniq-0065-00",
  "card-06002-5-uniq-0066-00",
].sort();

const EXPECTED_FORMATION_KINDS = ["accessible-4-star", "premium", "standard"].sort();

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

  it("indexes each exact requested guide anchor and slug once", () => {
    expect(nativeGuideData.guides.map((guide) => guide.anchorCardId).sort()).toEqual(
      EXPECTED_GUIDE_ANCHOR_CARD_IDS,
    );
    expect(nativeGuideBySlug.size).toBe(nativeGuideData.guides.length);
    expect(nativeGuideByAnchorCardId.size).toBe(nativeGuideData.guides.length);
  });

  it("preserves Leader and Passive roles when the same card supplies both", () => {
    for (const anchorCardId of [
      "card-00013-5-uniq-0002-00",
      "card-00019-5-uniq-0016-00",
      "card-06002-5-uniq-0066-00",
    ]) {
      const guide = nativeGuideByAnchorCardId.get(anchorCardId)!;
      for (const kind of ["premium", "standard"] as const) {
        const formation = guide.formations.find((candidate) => candidate.kind === kind)!;
        expect(formation.leaderOutfitCardId).toBe(anchorCardId);
        const sharedSourceRows = formation.recipients.filter(
          (recipient) => recipient.sourceCardId === anchorCardId,
        );
        expect(new Set(sharedSourceRows.map((recipient) => recipient.source))).toEqual(
          new Set(["leader", "passive"]),
        );
      }
    }
  });

  it("publishes legal exact-anchor formations and genuinely accessible options", () => {
    expect(nativeGuideData.rosterCommit).toBe(nativeRankingData.rosterCommit);

    for (const guide of nativeGuideData.guides) {
      const anchor = publicCardById.get(guide.anchorCardId);
      expect(anchor, `missing guide anchor ${guide.anchorCardId}`).toBeDefined();
      if (!anchor) throw new Error(`Missing guide anchor ${guide.anchorCardId}`);

      expect(anchor.rarity).toBe(5);
      expect(guide.anchorTalentId).toBe(anchor.talentId);
      expect(guide.ratingSongScope.singerTalentId).toBe(anchor.talentId);
      expect(guide.snapshotId).toBe(nativeRankingData.snapshotId);
      expect(guide.benchmark).toMatchObject({
        accountState: "frozen-neutral-public-benchmark",
        platform: "mobile",
        board: { mode: "neutral", relativeContribution: 0 },
        collection: { memberUpgradeBonusPermyriad: 0 },
        eventBonusPermil: 0,
        scoreClaim: "relative-utility-only",
      });

      const formationKinds = guide.formations.map((formation) => formation.kind);
      expect(new Set(formationKinds).size).toBe(3);
      expect([...formationKinds].sort()).toEqual(EXPECTED_FORMATION_KINDS);

      for (const formation of guide.formations) {
        const cards = formation.members.map((member) => publicCardById.get(member.cardId));
        const leader = publicCardById.get(formation.leaderOutfitCardId);
        const song = songContextData.songs.find(
          (candidate) => candidate.id === formation.context.songId,
        );
        const chart = songContextData.charts.find(
          (candidate) => candidate.key === formation.context.chartKey,
        );
        expect(cards.every(Boolean)).toBe(true);
        expect(leader, `missing Leader Outfit ${formation.leaderOutfitCardId}`).toBeDefined();
        expect(song, `missing rating song ${formation.context.songId}`).toBeDefined();
        expect(chart, `missing rating chart ${formation.context.chartKey}`).toBeDefined();
        if (cards.some((card) => !card) || !leader || !song || !chart) {
          throw new Error(`Guide ${guide.id} contains an unresolved formation reference`);
        }

        const resolvedCards = cards.filter((card) => card !== undefined);
        const memberIds = resolvedCards.map((card) => card.id);
        expect(resolvedCards).toHaveLength(5);
        expect(new Set(memberIds).size).toBe(5);
        expect(new Set(resolvedCards.map((card) => card.talentId)).size).toBe(5);
        expect(memberIds.filter((cardId) => cardId === guide.anchorCardId)).toHaveLength(1);
        expect(formation.members.map((member) => member.slot).sort((a, b) => a - b)).toEqual([
          1, 2, 3, 4, 5,
        ]);
        expect([...formation.formationOrder].sort()).toEqual([...memberIds].sort());
        expect(formation.activeSkills.map((skill) => skill.cardId).sort()).toEqual(
          [...memberIds].sort(),
        );
        expect(formation.specialSkills.map((skill) => skill.cardId).sort()).toEqual(
          [...memberIds].sort(),
        );
        expect([...formation.investmentOrder].sort()).toEqual([...memberIds].sort());
        expect(formation.ordersAudited).toBe(120);
        expect(formation.orderStatus).toBe("canonical-display-only-timing-unresolved");

        expect(chart.songId).toBe(song.id);
        expect(chart.difficulty).toBe("expert");
        expect(chart.fullComboNoteCount).toBe(formation.context.noteCount);
        expect(song.title).toBe(formation.context.songTitle);
        expect(song.playingMilliseconds).toBe(formation.context.durationMilliseconds);
        expect(song.scoreRatingEligible).toBe(true);
        expect(song.singerTalentIds).toContain(guide.ratingSongScope.singerTalentId);
        expect(leader.talentId).toBe(guide.ratingSongScope.singerTalentId);

        expect(formation.activeSkills.every((skill) => skill.chartNoteCoverage === null)).toBe(true);
        expect(formation.specialSkills.every((skill) => skill.chartNoteCoverage === null)).toBe(true);
        expect(
          formation.staticParameters.base.central +
            formation.staticParameters.leaderAndPassiveGain.central,
        ).toBeCloseTo(formation.staticParameters.effective.central, 8);

        const legalEffectSourceIds = [...memberIds, leader.id];
        for (const recipient of formation.recipients) {
          expect(legalEffectSourceIds).toContain(recipient.sourceCardId);
          if (recipient.source === "leader") {
            expect(recipient.sourceCardId).toBe(leader.id);
          } else {
            expect(memberIds).toContain(recipient.sourceCardId);
          }
          expect(recipient.possibleCardIds.every((cardId) => memberIds.includes(cardId))).toBe(true);
          expect(
            recipient.commonToEveryAlternativeCardIds.every((cardId) => memberIds.includes(cardId)),
          ).toBe(true);
        }

        for (const replacement of formation.replacements) {
          const replacementCard = publicCardById.get(replacement.cardId);
          expect(replacementCard, `missing replacement ${replacement.cardId}`).toBeDefined();
          if (!replacementCard) throw new Error(`Missing replacement ${replacement.cardId}`);
          expect(memberIds).toContain(replacement.replacedCardId);
          expect(replacement.replacedCardId).not.toBe(guide.anchorCardId);
          expect(memberIds).not.toContain(replacement.cardId);
          expect(replacementCard.rarity).toBe(replacement.rarity);
          expect(replacement.lossPercent.central).toBeGreaterThanOrEqual(0);
          const replacementTalentIds = resolvedCards
            .filter((card) => card.id !== replacement.replacedCardId)
            .map((card) => card.talentId)
            .concat(replacementCard.talentId);
          expect(new Set(replacementTalentIds).size).toBe(5);
        }

        if (formation.kind === "accessible-4-star") {
          expect(leader.rarity).toBe(4);
          expect(resolvedCards.filter((card) => card.rarity === 5).map((card) => card.id)).toEqual([
            guide.anchorCardId,
          ]);
          expect(resolvedCards.filter((card) => card.rarity === 4)).toHaveLength(4);
        }
      }

      const expectedRatingSongIds = songContextData.songs
        .filter(
          (song) =>
            song.scoreRatingEligible &&
            song.singerTalentIds.includes(guide.ratingSongScope.singerTalentId),
        )
        .map((song) => song.id)
        .sort();
      expect(guide.ratingSongComparisons.map((comparison) => comparison.songId).sort()).toEqual(
        expectedRatingSongIds,
      );

      for (const comparison of guide.ratingSongComparisons) {
        const song = songContextData.songs.find((candidate) => candidate.id === comparison.songId);
        const chart = songContextData.charts.find(
          (candidate) => candidate.key === comparison.chartKey,
        );
        const leader = publicCardById.get(comparison.leaderOutfitCardId);
        const cards = comparison.members.map((cardId) => publicCardById.get(cardId));
        expect(song, `missing comparison song ${comparison.songId}`).toBeDefined();
        expect(chart, `missing comparison chart ${comparison.chartKey}`).toBeDefined();
        expect(leader, `missing comparison Leader ${comparison.leaderOutfitCardId}`).toBeDefined();
        expect(cards.every(Boolean)).toBe(true);
        if (!song || !chart || !leader || cards.some((card) => !card)) {
          throw new Error(`Guide ${guide.id} contains an unresolved song comparison reference`);
        }

        const resolvedCards = cards.filter((card) => card !== undefined);
        expect(new Set(comparison.members).size).toBe(5);
        expect(new Set(resolvedCards.map((card) => card.talentId)).size).toBe(5);
        expect(comparison.members.filter((cardId) => cardId === guide.anchorCardId)).toHaveLength(1);
        expect([...comparison.formationOrder].sort()).toEqual([...comparison.members].sort());
        expect(chart.songId).toBe(song.id);
        expect(chart.difficulty).toBe("expert");
        expect(chart.fullComboNoteCount).toBe(comparison.noteCount);
        expect(song.title).toBe(comparison.songTitle);
        expect(song.playingMilliseconds).toBe(comparison.durationMilliseconds);
        expect(song.scoreRatingEligible).toBe(true);
        expect(song.singerTalentIds).toContain(guide.ratingSongScope.singerTalentId);
        expect(leader.talentId).toBe(guide.ratingSongScope.singerTalentId);
        expect(comparison.platform).toBe("mobile");
        expect(comparison.noteTimeline).toBe("unavailable");
      }
    }
  });
});
