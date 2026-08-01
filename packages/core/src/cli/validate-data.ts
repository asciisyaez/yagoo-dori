import { publicData, publicCards } from "../public-data";
import { mechanicsData } from "../mechanics";
import { nativeGuideData } from "../native-guide-data";
import { nativeRankingData } from "../native-ranking-data";
import { songContextData } from "../song-contexts";

const sampleIds = [
  "card-00013-5-uniq-0002-00",
  "card-00012-5-uniq-0062-00",
  "card-06003-4-cmmn-0000-00",
];

for (const id of sampleIds) {
  if (!publicCards.some((card) => card.id === id)) {
    throw new Error(`Pinned representative card is missing: ${id}`);
  }
}

const azki = publicCards.find((card) => card.id === "card-00013-5-uniq-0002-00");
if (
  !azki ||
  azki.attribute !== "pure" ||
  azki.parameters.maxPotential.performance !== 6803 ||
  azki.parameters.maxPotential.technique !== 7682 ||
  azki.parameters.maxPotential.sense !== 11380
) {
  throw new Error("AZKi golden record no longer matches the pinned data and AppMedia corroboration.");
}

if (publicCards.some((card) => /research slot|illustrative/i.test(`${card.title} ${card.talentName}`))) {
  throw new Error("Synthetic research fixtures are not allowed in the public dataset.");
}

const publicIds = new Set(publicCards.map((card) => card.id));
for (const [context, lenses] of [
  ["Member", nativeRankingData.lenses],
  ["Leader/Outfit", nativeRankingData.leaderOutfitLenses],
] as const) {
  for (const lens of lenses) {
    const rankedIds = new Set(lens.entries.map((entry) => entry.cardId));
    if (rankedIds.size !== publicIds.size || [...publicIds].some((id) => !rankedIds.has(id))) {
      throw new Error(`${context} ${lens.label} does not rank the exact pinned public roster.`);
    }
  }
}
if (nativeRankingData.rosterCommit !== mechanicsData.sourceSnapshot.commit) {
  throw new Error("Native ranking snapshot and mechanics catalog use different roster commits.");
}
if (nativeRankingData.absoluteScoreAvailable) {
  throw new Error("An absolute score cannot be published before the runtime equation is validated.");
}

for (const guide of nativeGuideData.guides) {
  const anchor = publicCards.find((card) => card.id === guide.anchorCardId);
  if (!anchor || anchor.rarity !== 5 || anchor.talentId !== guide.anchorTalentId) {
    throw new Error(`${guide.slug} does not resolve to its exact 5-star anchor.`);
  }
  if (guide.snapshotId !== nativeRankingData.snapshotId) {
    throw new Error(`${guide.slug} was not generated against the published ranking snapshot.`);
  }
  for (const formation of guide.formations) {
    const leader = publicCards.find((card) => card.id === formation.leaderOutfitCardId);
    const members = formation.members.map((member) => publicCards.find((card) => card.id === member.cardId));
    if (!leader || members.some((card) => !card)) {
      throw new Error(`${guide.slug}/${formation.kind} references a missing card.`);
    }
    const talents = new Set(members.map((card) => card!.talentId));
    if (talents.size !== 5 || !members.some((card) => card!.id === guide.anchorCardId)) {
      throw new Error(`${guide.slug}/${formation.kind} is not a legal anchored five-Member team.`);
    }
    if (
      formation.kind === "accessible-4-star" &&
      (leader.rarity !== 4 || members.filter((card) => card!.rarity === 5).length > 1)
    ) {
      throw new Error(`${guide.slug} does not satisfy its 4-star-accessible constraint.`);
    }
    const expectedStatic = {
      lower: formation.staticParameters.base.lower + formation.staticParameters.leaderAndPassiveGain.lower,
      central: formation.staticParameters.base.central + formation.staticParameters.leaderAndPassiveGain.central,
      upper: formation.staticParameters.base.upper + formation.staticParameters.leaderAndPassiveGain.upper,
    };
    if (
      (Object.keys(expectedStatic) as Array<keyof typeof expectedStatic>).some(
        (key) => Math.abs(expectedStatic[key] - formation.staticParameters.effective[key]) > 0.000_001,
      )
    ) {
      throw new Error(`${guide.slug}/${formation.kind} static parameter arithmetic does not reconcile.`);
    }
    if (formation.replacements.some((replacement) => replacement.lossPercent.central < -0.000_001)) {
      throw new Error(`${guide.slug}/${formation.kind} is locally dominated by a listed replacement.`);
    }
  }
}

console.log(
  `Public dataset valid: ${publicData.counts.talents} talents, ` +
    `${publicData.counts.fiveStar} five-star cards, ${publicData.counts.fourStar} four-star cards, ` +
    `${publicData.counts.art} local art mappings.`,
);
console.log(`Pinned ENG ${publicData.sourceSnapshots.english.commit}; JPN ${publicData.sourceSnapshots.japanese.commit}.`);
console.log(
  `Mechanics catalog valid: ${mechanicsData.coverage.mappedCards}/${mechanicsData.coverage.cards} cards mapped, ` +
    `${mechanicsData.coverage.unresolvedReferences.length} unresolved references.`,
);
console.log(
  `Song contexts valid: ${songContextData.counts.songs} songs, ` +
    `${songContextData.counts.aggregateCharts} aggregate charts, ` +
    `${songContextData.counts.timedCharts} timed charts.`,
);
console.log(
  `Native output valid: 2 ranking contexts x ${nativeRankingData.lenses.length} lenses x ` +
    `${publicIds.size} cards, ${nativeGuideData.guides.length} generated guide.`,
);
