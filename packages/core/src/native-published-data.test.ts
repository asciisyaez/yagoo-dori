import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import cardArtManifestJson from "../../../data/generated/card-art-manifest.json";

import { mechanicsCardById } from "./mechanics";
import { chartTimelineData } from "./chart-timelines";
import { guideRatingTimelineUnavailableByKey } from "./guide-rating-timelines";
import {
  nativeGuideByAnchorCardId,
  nativeGuideBySlug,
  nativeGuideData,
} from "./native-guide-data";
import { nativeRankingData } from "./native-ranking-data";
import { evaluateNativeRelativeUtility } from "./native-utility";
import { publicCardById, publicCards, publicData } from "./public-data";
import { songContextData } from "./song-contexts";

const PINNED_GUIDE_ROSTER_COMMIT = "b1f9535bbdc4473e384adab7b41a0e26e06363d7";

const EXPECTED_GUIDE_IDENTITIES = [
  {
    anchorCardId: "card-00012-5-uniq-0062-00",
    talentId: "chr-00012",
    talentName: "Oozora Subaru",
    cardTitle: "Vibrant Sun Splash!",
    leaders: {
      premium: "card-00012-5-uniq-0012-00",
      standard: "card-00012-5-uniq-0012-00",
      "accessible-4-star": "card-00012-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00013-5-uniq-0002-00",
    talentId: "chr-00013",
    talentName: "AZKi",
    cardTitle: "A Flower in Full Bloom",
    leaders: {
      premium: "card-00013-5-uniq-0002-00",
      standard: "card-00013-5-uniq-0002-00",
      "accessible-4-star": "card-00013-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00015-5-uniq-0067-00",
    talentId: "chr-00015",
    talentName: "Sakura Miko",
    cardTitle: "Radiant Beach Shot",
    leaders: {
      premium: "card-00015-5-uniq-0067-00",
      standard: "card-00015-5-uniq-0003-00",
      "accessible-4-star": "card-00015-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00018-5-uniq-0068-00",
    talentId: "chr-00018",
    talentName: "Hoshimachi Suisei",
    cardTitle: "Water Gun Arpeggio",
    leaders: {
      premium: "card-00018-5-uniq-0068-00",
      standard: "card-00018-5-uniq-0068-00",
      "accessible-4-star": "card-00018-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00019-5-uniq-0016-00",
    talentId: "chr-00019",
    talentName: "Usada Pekora",
    cardTitle: "Playful Rabbit Field",
    leaders: {
      premium: "card-00019-5-uniq-0016-00",
      standard: "card-00019-5-uniq-0016-00",
      "accessible-4-star": "card-00019-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00021-5-uniq-0064-00",
    talentId: "chr-00021",
    talentName: "Shiranui Flare",
    cardTitle: "Sparks at Sunset",
    leaders: {
      premium: "card-00021-5-uniq-0064-00",
      standard: "card-00021-5-uniq-0064-00",
      "accessible-4-star": "card-00021-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00022-5-uniq-0063-00",
    talentId: "chr-00022",
    talentName: "Shirogane Noel",
    cardTitle: "Serene Wave Knight",
    leaders: {
      premium: "card-00022-5-uniq-0063-00",
      standard: "card-00022-5-uniq-0063-00",
      "accessible-4-star": "card-00022-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-00026-5-uniq-0065-00",
    talentId: "chr-00026",
    talentName: "Tsunomaki Watame",
    cardTitle: "Floatie Float Time",
    leaders: {
      premium: "card-00026-5-uniq-0065-00",
      standard: "card-00026-5-uniq-0065-00",
      "accessible-4-star": "card-00026-4-cmmn-0000-00",
    },
  },
  {
    anchorCardId: "card-06002-5-uniq-0066-00",
    talentId: "chr-06002",
    talentName: "Otonose Kanade",
    cardTitle: "Breezy Smile Chords",
    leaders: {
      premium: "card-06002-5-uniq-0066-00",
      standard: "card-06002-5-uniq-0066-00",
      "accessible-4-star": "card-06002-4-cmmn-0000-00",
    },
  },
] as const;

const EXPECTED_LEADER_IDENTITIES = {
  "card-00012-4-cmmn-0000-00": {
    cardTitle: "Radiant Soul Jam",
    costumeId: "cos-00012-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00012-4-cmmn-0000-00",
  },
  "card-00012-5-uniq-0012-00": {
    cardTitle: "Duckling Noon Jam",
    costumeId: "cos-00012-uniq-0012-00",
    costumeName: "Duckie Bounce!",
    leaderSkillId: "live_leader_skill-card-00012-5-uniq-0012-00",
  },
  "card-00013-4-cmmn-0000-00": {
    cardTitle: "Upon a Tender Melody",
    costumeId: "cos-00013-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00013-4-cmmn-0000-00",
  },
  "card-00013-5-uniq-0002-00": {
    cardTitle: "A Flower in Full Bloom",
    costumeId: "cos-00013-uniq-0002-00",
    costumeName: "Graceful Scent",
    leaderSkillId: "live_leader_skill-card-00013-5-uniq-0002-00",
  },
  "card-00015-4-cmmn-0000-00": {
    cardTitle: "Embrace the Glow",
    costumeId: "cos-00015-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00015-4-cmmn-0000-00",
  },
  "card-00015-5-uniq-0003-00": {
    cardTitle: "Sakura Bloom",
    costumeId: "cos-00015-uniq-0003-00",
    costumeName: "Splendor of Cherry Blossoms",
    leaderSkillId: "live_leader_skill-card-00015-5-uniq-0003-00",
  },
  "card-00015-5-uniq-0067-00": {
    cardTitle: "Radiant Beach Shot",
    costumeId: "cos-00015-uniq-0067-00",
    costumeName: "Radiance Smile",
    leaderSkillId: "live_leader_skill-card-00015-5-uniq-0067-00",
  },
  "card-00018-4-cmmn-0000-00": {
    cardTitle: "Radiant Floor Star",
    costumeId: "cos-00018-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00018-4-cmmn-0000-00",
  },
  "card-00018-5-uniq-0068-00": {
    cardTitle: "Water Gun Arpeggio",
    costumeId: "cos-00018-uniq-0068-00",
    costumeName: "Melody of the Tides",
    leaderSkillId: "live_leader_skill-card-00018-5-uniq-0068-00",
  },
  "card-00019-4-cmmn-0000-00": {
    cardTitle: "Vogue Hop Bunny",
    costumeId: "cos-00019-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00019-4-cmmn-0000-00",
  },
  "card-00019-5-uniq-0016-00": {
    cardTitle: "Playful Rabbit Field",
    costumeId: "cos-00019-uniq-0016-00",
    costumeName: "Anarchy Rabbit",
    leaderSkillId: "live_leader_skill-card-00019-5-uniq-0016-00",
  },
  "card-00021-4-cmmn-0000-00": {
    cardTitle: "Graceful Empathy",
    costumeId: "cos-00021-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00021-4-cmmn-0000-00",
  },
  "card-00021-5-uniq-0064-00": {
    cardTitle: "Sparks at Sunset",
    costumeId: "cos-00021-uniq-0064-00",
    costumeName: "You're My Sunflower",
    leaderSkillId: "live_leader_skill-card-00021-5-uniq-0064-00",
  },
  "card-00022-4-cmmn-0000-00": {
    cardTitle: "Vocal Juggernaut",
    costumeId: "cos-00022-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00022-4-cmmn-0000-00",
  },
  "card-00022-5-uniq-0063-00": {
    cardTitle: "Serene Wave Knight",
    costumeId: "cos-00022-uniq-0063-00",
    costumeName: "Soleil Kiss",
    leaderSkillId: "live_leader_skill-card-00022-5-uniq-0063-00",
  },
  "card-00026-4-cmmn-0000-00": {
    cardTitle: "Zenith Resonance",
    costumeId: "cos-00026-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-00026-4-cmmn-0000-00",
  },
  "card-00026-5-uniq-0065-00": {
    cardTitle: "Floatie Float Time",
    costumeId: "cos-00026-uniq-0065-00",
    costumeName: "Beaming Sol",
    leaderSkillId: "live_leader_skill-card-00026-5-uniq-0065-00",
  },
  "card-06002-4-cmmn-0000-00": {
    cardTitle: "Apex Harmony",
    costumeId: "cos-06002-cmmn-0000-00",
    costumeName: "Dreamy Drop",
    leaderSkillId: "live_leader_skill-card-06002-4-cmmn-0000-00",
  },
  "card-06002-5-uniq-0066-00": {
    cardTitle: "Breezy Smile Chords",
    costumeId: "cos-06002-uniq-0066-00",
    costumeName: "Sunflower Symphony",
    leaderSkillId: "live_leader_skill-card-06002-5-uniq-0066-00",
  },
} as const;

const EXPECTED_GUIDE_ANCHOR_CARD_IDS = [
  "card-00012-5-uniq-0062-00",
  "card-00013-5-uniq-0002-00",
  "card-00015-5-uniq-0067-00",
  "card-00018-5-uniq-0068-00",
  "card-00019-5-uniq-0016-00",
  "card-00021-5-uniq-0064-00",
  "card-00022-5-uniq-0063-00",
  "card-00026-5-uniq-0065-00",
  "card-06002-5-uniq-0066-00",
].sort();

const EXPECTED_FORMATION_KINDS = ["accessible-4-star", "premium", "standard"].sort();

const artAssetByCardId = new Map(
  cardArtManifestJson.assets.map((asset) => [asset.cardId, asset]),
);

function localWebAssetExists(localPath: string) {
  return existsSync(
    fileURLToPath(new URL(`../../../apps/web/public${localPath}`, import.meta.url)),
  );
}

function collectGuideCardReferences() {
  const cardIds = new Set<string>();
  for (const guide of nativeGuideData.guides) {
    cardIds.add(guide.anchorCardId);
    for (const formation of guide.formations) {
      cardIds.add(formation.leaderOutfitCardId);
      formation.members.forEach((member) => cardIds.add(member.cardId));
      formation.formationOrder.forEach((cardId) => cardIds.add(cardId));
      formation.activeSkills.forEach((skill) => cardIds.add(skill.cardId));
      formation.specialSkills.forEach((skill) => cardIds.add(skill.cardId));
      formation.investmentOrder.forEach((cardId) => cardIds.add(cardId));
      for (const recipient of formation.recipients) {
        cardIds.add(recipient.sourceCardId);
        recipient.possibleCardIds.forEach((cardId) => cardIds.add(cardId));
        recipient.commonToEveryAlternativeCardIds.forEach((cardId) => cardIds.add(cardId));
      }
      for (const replacement of formation.replacements) {
        cardIds.add(replacement.replacedCardId);
        cardIds.add(replacement.cardId);
      }
    }
    for (const comparison of guide.ratingSongComparisons) {
      cardIds.add(comparison.leaderOutfitCardId);
      comparison.members.forEach((cardId) => cardIds.add(cardId));
      comparison.formationOrder.forEach((cardId) => cardIds.add(cardId));
    }
  }
  return cardIds;
}

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

  it("pins exact anchor and Leader identities to the audited raw Card-to-Costume join", () => {
    expect(publicData.sourceSnapshots.english.commit).toBe(PINNED_GUIDE_ROSTER_COMMIT);
    expect(nativeGuideData.rosterCommit).toBe(PINNED_GUIDE_ROSTER_COMMIT);

    for (const expected of EXPECTED_GUIDE_IDENTITIES) {
      const guide = nativeGuideByAnchorCardId.get(expected.anchorCardId);
      const anchor = publicCardById.get(expected.anchorCardId);
      expect(guide, `missing guide for ${expected.anchorCardId}`).toBeDefined();
      expect(anchor, `missing anchor ${expected.anchorCardId}`).toBeDefined();
      if (!guide || !anchor) throw new Error(`Missing exact guide anchor ${expected.anchorCardId}`);

      expect(anchor).toMatchObject({
        id: expected.anchorCardId,
        talentId: expected.talentId,
        talentName: expected.talentName,
        title: expected.cardTitle,
        assetId: expected.anchorCardId.replace(/^card-/, ""),
        artPath: `/game/cards/${expected.anchorCardId}.webp`,
        illustrationPath: `/game/illustrations/${expected.anchorCardId}.webp`,
      });
      expect(guide.anchorTalentId).toBe(expected.talentId);
      expect(guide.title).toBe(`${expected.talentName} — ${expected.cardTitle} team guide`);

      for (const formation of guide.formations) {
        const expectedLeaderId = expected.leaders[formation.kind];
        expect(formation.leaderOutfitCardId).toBe(expectedLeaderId);
      }
    }

    const leaderIds = new Set(
      nativeGuideData.guides.flatMap((guide) =>
        guide.formations.map((formation) => formation.leaderOutfitCardId),
      ),
    );
    expect([...leaderIds].sort()).toEqual(Object.keys(EXPECTED_LEADER_IDENTITIES).sort());

    for (const [cardId, expected] of Object.entries(EXPECTED_LEADER_IDENTITIES)) {
      const card = publicCardById.get(cardId);
      const mechanics = mechanicsCardById.get(cardId);
      expect(card, `missing public Leader source card ${cardId}`).toBeDefined();
      expect(mechanics, `missing mechanics for Leader source card ${cardId}`).toBeDefined();
      if (!card || !mechanics) throw new Error(`Missing Leader identity ${cardId}`);

      expect(card.title).toBe(expected.cardTitle);
      expect(card.leaderOutfit.costumeId).toBe(expected.costumeId);
      expect(card.leaderOutfit.costumeName).toBe(expected.costumeName);
      expect(card.artPath).toBe(`/game/cards/${cardId}.webp`);
      expect(mechanics.talentId).toBe(card.talentId);
      expect(mechanics.leaderOutfit.costumeId).toBe(expected.costumeId);
      expect(mechanics.leaderOutfit.talentId).toBe(card.talentId);
      expect(mechanics.leaderOutfit.leaderSkillId).toBe(expected.leaderSkillId);
    }
  });

  it("resolves every guide card reference to one matching public, mechanics, and local-art record", () => {
    const referencedCardIds = collectGuideCardReferences();
    expect(referencedCardIds.size).toBe(83);

    for (const cardId of referencedCardIds) {
      const card = publicCardById.get(cardId);
      const mechanics = mechanicsCardById.get(cardId);
      const manifestMatches = cardArtManifestJson.assets.filter((asset) => asset.cardId === cardId);
      const asset = artAssetByCardId.get(cardId);
      expect(card, `missing public card ${cardId}`).toBeDefined();
      expect(mechanics, `missing mechanics ${cardId}`).toBeDefined();
      expect(manifestMatches, `asset manifest identity collision for ${cardId}`).toHaveLength(1);
      expect(asset, `missing local art manifest record ${cardId}`).toBeDefined();
      if (!card || !mechanics || !asset) throw new Error(`Unresolved guide card ${cardId}`);

      expect(card.assetId).toBe(cardId.replace(/^card-/, ""));
      expect(card.artPath).toBe(`/game/cards/${cardId}.webp`);
      expect(card.illustrationPath).toBe(`/game/illustrations/${cardId}.webp`);
      expect(mechanics.cardId).toBe(cardId);
      expect(mechanics.talentId).toBe(card.talentId);
      expect(mechanics.rarity).toBe(card.rarity);

      expect(asset).toMatchObject({
        cardId,
        talentId: card.talentId,
        status: "downloaded",
        icon: {
          cardId,
          talentId: card.talentId,
          localPath: card.artPath,
        },
        illustration: {
          cardId,
          talentId: card.talentId,
          localPath: card.illustrationPath,
        },
      });
      expect(asset.icon.width).toBeGreaterThan(0);
      expect(asset.icon.height).toBeGreaterThan(0);
      expect(asset.icon.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.illustration.width).toBeGreaterThan(0);
      expect(asset.illustration.height).toBeGreaterThan(0);
      expect(asset.illustration.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(localWebAssetExists(card.artPath), `missing ${card.artPath}`).toBe(true);
      expect(
        localWebAssetExists(card.illustrationPath),
        `missing ${card.illustrationPath}`,
      ).toBe(true);
    }
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
        expect(formation.ordersAudited).toBeGreaterThanOrEqual(120);
        expect(formation.ordersAudited % 120).toBe(0);
        expect(["modeled-general", "timed-corpus", "indeterminate"]).toContain(
          formation.orderStatus,
        );
        expect(formation.formationOrderModel).toMatchObject({
          corpusChartCount: 30,
          permutationsChecked: 120,
        });
        const formationUsesTimedCorpus =
          formation.formationOrderModel.methodologyVersion ===
          "yd-formation-order-timed-corpus-1.0.0";
        expect(
          formation.orderStatus === "indeterminate" ||
            formation.orderStatus ===
              (formationUsesTimedCorpus ? "timed-corpus" : "modeled-general"),
        ).toBe(true);
        expect(formation.formationOrderModel).toMatchObject({
          markerLayoutCount: formationUsesTimedCorpus ? 1 : 14,
          timingScenarioCount: formationUsesTimedCorpus ? 30 : 420,
          exactTimelineAvailable: formationUsesTimedCorpus,
          noteTimelineAvailable: formationUsesTimedCorpus,
          changesModeledTimingUtility: formationUsesTimedCorpus,
        });
        expect(formation.formationOrderModel.timingScenarioCount).toBe(
          formation.formationOrderModel.corpusChartCount *
            formation.formationOrderModel.markerLayoutCount,
        );

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
          expect(replacement.tradeoff.benefit.length).toBeGreaterThan(0);
          expect(replacement.tradeoff.cost.length).toBeGreaterThan(0);
          expect(["modeled-general", "timed-corpus", "indeterminate"]).toContain(
            replacement.orderStatus,
          );
          expect(replacement.suggestedOrder).toContain(replacement.cardId);
          expect(replacement.suggestedOrder).not.toContain(replacement.replacedCardId);
          expect(
            replacement.tradeoff.possibleRecipientCardIdsAdded.every((cardId) =>
              replacement.suggestedOrder.includes(cardId),
            ),
          ).toBe(true);
          expect(
            replacement.tradeoff.possibleRecipientCardIdsRemoved.every((cardId) =>
              memberIds.includes(cardId),
            ),
          ).toBe(true);
          const replacementTalentIds = resolvedCards
            .filter((card) => card.id !== replacement.replacedCardId)
            .map((card) => card.talentId)
            .concat(replacementCard.talentId);
          expect(new Set(replacementTalentIds).size).toBe(5);
          const investment = formation.kind === "premium"
            ? "duplicate-enabled-ceiling" as const
            : "one-copy-maximum" as const;
          const selectedUtility = evaluateNativeRelativeUtility({
            formation: {
              leaderOutfitCardId: formation.leaderOutfitCardId,
              members: formation.formationOrder.map((cardId) => ({ cardId, investment })),
            },
            chartKey: formation.context.chartKey,
            seed: 0x5eed,
            accountState: {
              board: {
                mode: "declared-neutral",
                evidenceGrade: "verified",
                evidenceRef: "methodology:neutral-board-v1",
              },
            },
          });
          const alternativeUtility = evaluateNativeRelativeUtility({
            formation: {
              leaderOutfitCardId: formation.leaderOutfitCardId,
              members: replacement.suggestedOrder.map((cardId) => ({ cardId, investment })),
            },
            chartKey: formation.context.chartKey,
            seed: 0x5eed,
            accountState: {
              board: {
                mode: "declared-neutral",
                evidenceGrade: "verified",
                evidenceRef: "methodology:neutral-board-v1",
              },
            },
          });
          expect(replacement.lossPercent.central).toBeCloseTo(
            ((selectedUtility.relativeUtility.central - alternativeUtility.relativeUtility.central) /
              selectedUtility.relativeUtility.central) * 100,
            4,
          );
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
        if (comparison.noteTimeline === "unavailable") {
          const projected = guideRatingTimelineUnavailableByKey.get(comparison.chartKey);
          const source = chartTimelineData.unavailableCharts.find(
            (candidate) => candidate.key === comparison.chartKey,
          );
          expect(projected).toBeDefined();
          expect(source).toBeDefined();
          if (!projected || !source) throw new Error(`Missing unavailable timeline ${comparison.chartKey}`);
          expect(projected.expectedChartHash).toBe(source.upstreamChartHash);
          expect(projected.fullComboNoteCount).toBe(source.fullComboNoteCount);
          expect(projected.reason).toBe(source.reason);
          expect(comparison.comparisonMode).toBe("aggregate-formation-only");
          expect(comparison.timelineUnavailableReason).toBe(source.reason);
          expect(comparison.orderStatus).toBe("indeterminate");
          expect(comparison.formationOrder).toEqual([...comparison.members].sort());
          expect(comparison.advantageOverReferencePercent !== null).toBe(
            comparison.changesReferenceFormation,
          );
          expect("formationOrderModel" in comparison).toBe(false);
          expect("timelineEvidence" in comparison).toBe(false);
          continue;
        }
        expect(comparison.noteTimeline).toBe("exact");
        expect(comparison.formationOrderTimelineFidelity).toBe("exact-timed");
        expect(["modeled-general", "timed-corpus", "indeterminate"]).toContain(
          comparison.orderStatus,
        );
        const comparisonUsesTimedCorpus = true;
        expect(
          comparison.orderStatus === "indeterminate" ||
            comparison.orderStatus ===
              (comparisonUsesTimedCorpus ? "timed-corpus" : "modeled-general"),
        ).toBe(true);
        expect(comparison.formationOrderModel).toMatchObject({
          corpusChartCount: 1,
          markerLayoutCount: 1,
          timingScenarioCount: 1,
          exactTimelineAvailable: comparisonUsesTimedCorpus,
          noteTimelineAvailable: comparisonUsesTimedCorpus,
          changesModeledTimingUtility: comparisonUsesTimedCorpus,
        });
      }
    }
  });
});
