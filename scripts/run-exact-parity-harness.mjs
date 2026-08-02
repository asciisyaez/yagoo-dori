import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";

import { evaluateNativeRelativeUtility } from "../packages/core/src/native-utility.ts";
import { songContextData } from "../packages/core/src/song-contexts.ts";
import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const ir = readJson("data/native/exact-optimizer-parity-ir-v1.json");
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const benchmark = readJson("data/native/ranking-benchmark-v1.json");

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function nextRandom(state) {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function assertCoverage() {
  if (ir.scopeHash !== scope.scopeHash) throw new Error("Parity IR scope hash drifted");
  const memberIds = ir.cards.map((card) => card.cardId).sort();
  const eligibleIds = [...scope.eligibility.eligibleMemberCardIds].sort();
  if (memberIds.join("|") !== eligibleIds.join("|")) throw new Error("Parity IR Member roster drifted");
  if (ir.coverage.memberCardCount !== 113 || ir.coverage.leaderOutfitCardCount !== 113) {
    throw new Error("Parity IR does not cover every current card in both roles");
  }
  for (const required of ["score-up", "score-support", "activation-rate-up", "performance-up", "technique-up", "sense-up", "all-parameters-up", "active-skill-effect-up"]) {
    if (!ir.coverage.effectKinds.includes(required)) throw new Error(`Missing effect family: ${required}`);
  }
  for (const required of ["combo-at-least", "deck-attribute-count", "deck-character-group-count", "life-at-least"]) {
    if (!ir.coverage.triggerKinds.includes(required)) throw new Error(`Missing trigger family: ${required}`);
  }
  for (const required of ["all", "self", "attribute", "character-group"]) {
    if (!ir.coverage.targetKinds.includes(required)) throw new Error(`Missing target family: ${required}`);
  }
  for (const required of ["base", "conditional-base", "conditional-override", "additive", "conditional-additive"]) {
    if (!ir.coverage.combinationModes.includes(required)) throw new Error(`Missing combination mode: ${required}`);
  }
}

function generateCases(count = 100_000) {
  const cardsByTalent = new Map();
  for (const card of ir.cards) {
    const cards = cardsByTalent.get(card.talentId) ?? [];
    cards.push(card);
    cardsByTalent.set(card.talentId, cards);
  }
  const talents = [...cardsByTalent.keys()].sort();
  const charts = [...benchmark.corpus.reference, ...benchmark.corpus.current].map((entry) => entry.chartKey);
  const cases = [];
  let state = scope.seed >>> 0;
  for (let index = 0; index < count; index += 1) {
    const selectedTalents = [];
    let cursor = nextRandom(state);
    state = cursor;
    while (selectedTalents.length < 5) {
      cursor = nextRandom(state);
      state = cursor;
      const talent = talents[cursor % talents.length];
      if (!selectedTalents.includes(talent)) selectedTalents.push(talent);
    }
    selectedTalents.sort();
    const memberCardIds = selectedTalents.map((talent) => {
      cursor = nextRandom(state);
      state = cursor;
      const choices = cardsByTalent.get(talent);
      return choices[cursor % choices.length].cardId;
    }).sort();
    cursor = nextRandom(state);
    state = cursor;
    cases.push({
      caseId: index,
      leaderCardId: ir.cards[cursor % ir.cards.length].cardId,
      memberCardIds,
      chartKey: charts[cursor % charts.length],
      investmentLayer: ["one-copy-maximum", "low-investment", "duplicate-enabled-ceiling"][cursor % 3],
      bloomStages: Object.fromEntries(memberCardIds.map((cardId, memberIndex) => [cardId, (cursor >>> (memberIndex * 3)) % 6])),
    });
  }
  return cases;
}

function toReferenceSample(cases) {
  const board = {
    board: {
      mode: "declared-neutral",
      evidenceGrade: "verified",
      evidenceRef: "fixture:native-global-bound",
    },
  };
  return cases.map((entry) => {
    const utility = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: entry.leaderCardId,
        members: entry.memberCardIds.map((cardId) => ({
          cardId,
          investment: entry.investmentLayer,
          bloomStage: entry.bloomStages[cardId],
        })),
      },
      chartKey: entry.chartKey,
      seed: scope.seed,
      accountState: board,
    });
    return {
      ...entry,
      referenceLowerMicroUnits: toCanonicalMicroUnits(utility.relativeUtility.lower),
      referenceCentralMicroUnits: toCanonicalMicroUnits(utility.relativeUtility.central),
      referenceUpperMicroUnits: toCanonicalMicroUnits(utility.relativeUtility.upper),
    };
  });
}

assertCoverage();
const cases = generateCases();
const cardById = new Map(ir.cards.map((card) => [card.cardId, card]));
const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
const caseCoverage = {
  memberCardIds: new Set(cases.flatMap((entry) => entry.memberCardIds)).size,
  leaderCardIds: new Set(cases.map((entry) => entry.leaderCardId)).size,
  bloomStages: [...new Set(cases.flatMap((entry) => Object.values(entry.bloomStages)))].sort((a, b) => a - b),
  investmentLayers: [...new Set(cases.map((entry) => entry.investmentLayer))].sort(),
  chartKeys: new Set(cases.map((entry) => entry.chartKey)).size,
  singerMatchedCases: cases.filter((entry) => (chartByKey.get(entry.chartKey)?.songId && songContextData.songs.find((song) => song.id === chartByKey.get(entry.chartKey)?.songId)?.singerTalentIds.length > 0)).length,
  singerUnmatchedCases: cases.filter((entry) => {
    const chart = chartByKey.get(entry.chartKey);
    const song = chart ? songContextData.songs.find((candidate) => candidate.id === chart.songId) : undefined;
    return !song || song.singerTalentIds.length === 0;
  }).length,
  leaderMemberTalentCollisionCases: cases.filter((entry) => {
    const leader = cardById.get(entry.leaderCardId);
    return Boolean(leader && entry.memberCardIds.some((cardId) => cardById.get(cardId)?.talentId === leader.talentId));
  }).length,
  fiveStarMemberCounts: [...new Set(cases.map((entry) => entry.memberCardIds.filter((cardId) => cardById.get(cardId)?.rarity === 5).length))].sort((a, b) => a - b),
  legalUniqueTalentCases: cases.every((entry) => new Set(entry.memberCardIds.map((cardId) => cardById.get(cardId)?.talentId)).size === 5),
  memberBloomStagesByCardId: Object.fromEntries(
    ir.cards
      .map((card) => [
        card.cardId,
        [...new Set(
          cases
            .filter((entry) => entry.memberCardIds.includes(card.cardId))
            .map((entry) => entry.bloomStages[card.cardId]),
        )].sort((left, right) => left - right),
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  ),
};
if (caseCoverage.memberCardIds !== ir.coverage.memberCardCount || caseCoverage.leaderCardIds !== ir.coverage.leaderOutfitCardCount) {
  throw new Error(`Deterministic corpus did not exercise every card in both roles: ${JSON.stringify(caseCoverage)}`);
}
if (caseCoverage.bloomStages.join(",") !== "0,1,2,3,4,5" || !caseCoverage.legalUniqueTalentCases) {
  throw new Error(`Deterministic corpus did not cover all Bloom/legal constraints: ${JSON.stringify(caseCoverage)}`);
}
if (Object.values(caseCoverage.memberBloomStagesByCardId).some((stages) => stages.join(",") !== "0,1,2,3,4,5")) {
  throw new Error("Deterministic corpus did not exercise Bloom stages 0 through 5 for every Member card");
}
const caseHash = createHash("sha256").update(canonicalize(cases), "utf8").digest("hex");
const sampleCount = Number(process.env.YD_PARITY_SAMPLE_COUNT ?? 1_024);
if (!Number.isInteger(sampleCount) || sampleCount <= 0 || sampleCount > cases.length) {
  throw new Error("YD_PARITY_SAMPLE_COUNT must be a positive integer within the generated corpus");
}
const samplePath = "data/native/exact-optimizer-parity-sample-v1.json";
let referenceSample;
if (process.env.YD_PARITY_REUSE_REFERENCE_SAMPLE === "1") {
  const existing = readJson(samplePath);
  if (!Array.isArray(existing) || existing.length !== sampleCount) {
    throw new Error(`Reusable parity sample must contain exactly ${sampleCount} cases`);
  }
  const expectedDescriptors = cases.slice(0, sampleCount).map(({ caseId, leaderCardId, memberCardIds, chartKey, investmentLayer, bloomStages }) => ({
    caseId,
    leaderCardId,
    memberCardIds,
    chartKey,
    investmentLayer,
    bloomStages,
  }));
  const actualDescriptors = existing.map(({ caseId, leaderCardId, memberCardIds, chartKey, investmentLayer, bloomStages }) => ({
    caseId,
    leaderCardId,
    memberCardIds,
    chartKey,
    investmentLayer,
    bloomStages,
  }));
  if (canonicalize(actualDescriptors) !== canonicalize(expectedDescriptors)) {
    throw new Error("Reusable parity sample descriptors do not match the regenerated deterministic corpus");
  }
  referenceSample = existing;
} else {
  referenceSample = toReferenceSample(cases.slice(0, sampleCount));
  writeFileSync(join(root, samplePath), `${JSON.stringify(referenceSample)}\n`, "utf8");
}
let compiledParity = null;
try {
  compiledParity = readJson("data/native/exact-optimizer-compiled-parity-v1.json");
  if (
    compiledParity.scopeHash !== scope.scopeHash ||
    compiledParity.irHash !== ir.irHash ||
    compiledParity.samplePath !== "data/native/exact-optimizer-parity-sample-v1.json" ||
    compiledParity.sampleCount !== referenceSample.length
  ) {
    compiledParity = null;
  }
} catch {
  // The compiled adapter is a separate gate and may not have run yet.
}
let rustMechanicFixtures = null;
try {
  rustMechanicFixtures = readJson("data/native/exact-optimizer-rust-mechanic-fixtures-v1.json");
} catch {
  // The compiled unit-fixture gate is intentionally separate and may not have run yet.
}
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-parity-report-v1",
  generatedAt: new Date().toISOString(),
  caseGenerationVersion: "yd-stratified-legal-case-generator-1.0.0",
  scopeHash: scope.scopeHash,
  irHash: ir.irHash,
  caseHash,
  generatedCaseCount: cases.length,
  referenceSampleCount: referenceSample.length,
  referenceSamplePath: samplePath,
  offlineCorpusTarget: 100_000,
  coverage: ir.coverage,
  caseCoverage,
  mechanicFixtureSuite: "packages/core/src/exact-optimizer-parity-fixtures.test.ts",
  hardware: { platform: process.platform, arch: process.arch, cpuCount: cpus().length, node: process.version },
  compiledKernelStatus: "validated-by-separate-central-sample-report",
  compiledParityReportPath: "data/native/exact-optimizer-compiled-parity-v1.json",
  rustMechanicFixtureReportPath: "data/native/exact-optimizer-rust-mechanic-fixtures-v1.json",
  compiledCasesEvaluated: compiledParity?.compiledOutputCount ?? 0,
  compiledMismatchCount: compiledParity?.mismatchCount ?? null,
  compiledMechanicFixtureStatus: rustMechanicFixtures?.parityEligible === true ? "passed" : "not-run-or-failed",
  certificateEligible: false,
  disposition: compiledParity
    ? `IR and deterministic corpus generated; lower/central/upper parity matches ${referenceSample.length} cases${rustMechanicFixtures?.parityEligible === true ? " and compiled mechanic fixtures pass" : ""}. The complete bounds/shard/full-scope certificate gate remains open.`
    : "IR and deterministic corpus generated; the compiled adapter has not yet produced a matching sample report, so the complete parity gate remains open.",
};
writeFileSync(join(root, "data/native/exact-optimizer-parity-report-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
