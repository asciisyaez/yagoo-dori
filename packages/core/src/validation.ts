import type { DataBundle } from "./schemas";

export type ValidationResult = {
  ok: boolean;
  issues: string[];
};

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function checkIds(bundle: DataBundle, issues: string[]) {
  const collections = [
    ["sources", bundle.sources],
    ["assets", bundle.assets],
    ["patches", bundle.patches],
    ["talents", bundle.talents],
    ["skills", bundle.skills],
    ["cards", bundle.cards],
    ["leaders", bundle.leaders],
    ["guides", bundle.guides],
    ["reviews", bundle.reviews],
  ] as const;

  for (const [name, records] of collections) {
    for (const duplicate of duplicates(records.map((record) => record.id))) {
      issues.push(`Duplicate ${name} id ${duplicate}`);
    }
  }
}

function checkReferences(bundle: DataBundle, issues: string[]) {
  const sourceIds = new Set(bundle.sources.map((source) => source.id));
  const assetIds = new Set(bundle.assets.map((asset) => asset.id));
  const patchIds = new Set(bundle.patches.map((patch) => patch.id));
  const talentIds = new Set(bundle.talents.map((talent) => talent.id));
  const skillIds = new Set(bundle.skills.map((skill) => skill.id));
  const cardIds = new Set(bundle.cards.map((card) => card.id));
  const leaderIds = new Set(bundle.leaders.map((leader) => leader.id));

  const sourced = [
    ...bundle.patches,
    ...bundle.talents,
    ...bundle.skills,
    ...bundle.cards,
    ...bundle.leaders,
    ...bundle.guides,
  ];

  for (const record of sourced) {
    for (const sourceId of record.sourceIds) {
      if (!sourceIds.has(sourceId)) issues.push(`${record.id} references missing source ${sourceId}`);
    }
  }

  for (const card of bundle.cards) {
    if (!talentIds.has(card.talentId)) issues.push(`${card.id} references missing talent ${card.talentId}`);
    if (!patchIds.has(card.patchId)) issues.push(`${card.id} references missing patch ${card.patchId}`);
    for (const skillId of card.skillIds) {
      if (!skillIds.has(skillId)) issues.push(`${card.id} references missing skill ${skillId}`);
    }
    if (card.artAssetId && !assetIds.has(card.artAssetId)) {
      issues.push(`${card.id} references missing asset ${card.artAssetId}`);
    }
  }

  for (const leader of bundle.leaders) {
    if (!talentIds.has(leader.talentId)) issues.push(`${leader.id} references missing talent ${leader.talentId}`);
    if (!patchIds.has(leader.patchId)) issues.push(`${leader.id} references missing patch ${leader.patchId}`);
    if (leader.artAssetId && !assetIds.has(leader.artAssetId)) {
      issues.push(`${leader.id} references missing asset ${leader.artAssetId}`);
    }
  }

  for (const guide of bundle.guides) {
    if (!cardIds.has(guide.anchorCardId)) issues.push(`${guide.id} references missing anchor ${guide.anchorCardId}`);
    if (!leaderIds.has(guide.leaderOutfitId)) issues.push(`${guide.id} references missing Leader ${guide.leaderOutfitId}`);
    if (!patchIds.has(guide.patchId)) issues.push(`${guide.id} references missing patch ${guide.patchId}`);
    for (const formation of guide.formations) {
      for (const cardId of formation.cardIds) {
        if (!cardIds.has(cardId)) issues.push(`${guide.id}/${formation.label} references missing card ${cardId}`);
      }
      if (!formation.cardIds.includes(guide.anchorCardId)) {
        issues.push(`${guide.id}/${formation.label} omits exact anchor ${guide.anchorCardId}`);
      }
    }
  }

  for (const review of bundle.reviews) {
    for (const claim of review.claims) {
      if (!sourceIds.has(claim.sourceId)) issues.push(`${review.id} references missing source ${claim.sourceId}`);
    }
    if (review.resolution && !sourceIds.has(review.resolution.sourceId)) {
      issues.push(`${review.id} resolution references missing source ${review.resolution.sourceId}`);
    }
  }

  if (bundle.datasetManifest) {
    if (!patchIds.has(bundle.datasetManifest.patchId)) {
      issues.push(`${bundle.datasetManifest.id} references missing patch ${bundle.datasetManifest.patchId}`);
    }
    for (const sourceId of bundle.datasetManifest.sourceIds) {
      if (!sourceIds.has(sourceId)) issues.push(`${bundle.datasetManifest.id} references missing source ${sourceId}`);
    }
  }
}

function checkResearchBoundaries(bundle: DataBundle, issues: string[]) {
  const contradictory = [
    ...bundle.patches,
    ...bundle.talents,
    ...bundle.skills,
    ...bundle.cards,
    ...bundle.leaders,
    ...bundle.guides,
  ].filter((record) => record.illustrative && record.verificationState !== "research-only");

  for (const record of contradictory) {
    issues.push(`${record.id} is illustrative but marked ${record.verificationState}`);
  }

  for (const card of bundle.cards) {
    if (card.verificationState === "disputed") {
      issues.push(`${card.id} is disputed and cannot enter a ranking snapshot`);
    }
  }

  if (bundle.datasetManifest) {
    const fourStar = bundle.cards.filter((card) => card.rarity === 4).length;
    const fiveStar = bundle.cards.filter((card) => card.rarity === 5).length;
    if (
      bundle.datasetManifest.observedCounts.fourStar !== fourStar ||
      bundle.datasetManifest.observedCounts.fiveStar !== fiveStar ||
      bundle.datasetManifest.observedCounts.total !== bundle.cards.length
    ) {
      issues.push(`${bundle.datasetManifest.id} observed counts do not match normalized Member cards`);
    }
  }
}

export function validateBundle(bundle: DataBundle): ValidationResult {
  const issues: string[] = [];
  checkIds(bundle, issues);
  checkReferences(bundle, issues);
  checkResearchBoundaries(bundle, issues);
  return { ok: issues.length === 0, issues };
}

export function getPublicationReadiness(bundle: DataBundle) {
  const blockers: string[] = [];
  const validation = validateBundle(bundle);

  if (!validation.ok) blockers.push(...validation.issues);
  if (bundle.cards.length === 0 || bundle.cards.every((card) => card.illustrative)) {
    blockers.push("All Member-card records are illustrative research fixtures.");
  }
  if (!bundle.datasetManifest?.complete) {
    blockers.push("Complete launch-card counts are not yet verified against permitted upstream evidence.");
  }
  if (bundle.cards.some((card) => card.verificationState !== "verified" && card.verificationState !== "corroborated")) {
    blockers.push("One or more Member cards lack verified or corroborated evidence.");
  }
  if (bundle.assets.some((asset) => asset.rightsState !== "approved")) {
    blockers.push("One or more registered assets are not approved for production.");
  }
  if (bundle.cards.some((card) => card.artAssetId === null)) {
    blockers.push("Member-card artwork is pending rights; rights-safe treatments are required.");
  }

  return { ready: blockers.length === 0, blockers };
}
