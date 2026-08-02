import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateNativeRelativeUtility } from "../packages/core/src/native-utility.ts";
import {
  canonicalUtilityTie,
  toCanonicalMicroUnits,
} from "../packages/core/src/exact-optimizer-arithmetic.ts";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const parityCases = readJson("data/native/exact-optimizer-reduced-parity-cases-v1.json");

const board = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:exact-reduced-shards",
  },
};

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  if (Buffer.isBuffer(value)) return createHash("sha256").update(value).digest("hex");
  return createHash("sha256").update(typeof value === "string" ? value : canonicalize(value), "utf8").digest("hex");
}

function addressed(value, key) {
  const copy = { ...value };
  delete copy[key];
  return { ...value, [key]: sha256(copy) };
}

function candidateKey(candidate) {
  return `${candidate.leaderCardId}|${[...candidate.memberCardIds].sort().join("|")}`;
}

function compareCandidates(left, right) {
  for (const field of ["central", "lower", "upper"]) {
    if (left.utility[field] !== right.utility[field]) return right.utility[field] - left.utility[field];
  }
  return candidateKey(left).localeCompare(candidateKey(right));
}

function evaluate(entry) {
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
  }).relativeUtility;
  return {
    leaderCardId: entry.leaderCardId,
    memberCardIds: [...entry.memberCardIds].sort(),
    utility: {
      lower: toCanonicalMicroUnits(utility.lower),
      central: toCanonicalMicroUnits(utility.central),
      upper: toCanonicalMicroUnits(utility.upper),
    },
  };
}

const casesByTeam = new Map();
for (const entry of parityCases) {
  const key = [...entry.memberCardIds].sort().join("|");
  const cases = casesByTeam.get(key) ?? [];
  cases.push(entry);
  casesByTeam.set(key, cases);
}
const teams = [...casesByTeam.values()]
  .sort((left, right) => left[0].caseId - right[0].caseId)
  .map((entries) => ({
    key: [...entries[0].memberCardIds].sort().join("|"),
    memberCardIds: [...entries[0].memberCardIds].sort(),
    entries: [...entries].sort((left, right) => left.leaderCardId.localeCompare(right.leaderCardId)),
  }));
if (teams.length === 0) throw new Error("Reduced shard input has no legal teams");

const requestedShardCount = Number(process.env.YD_REDUCED_SHARD_COUNT ?? 2);
if (!Number.isInteger(requestedShardCount) || requestedShardCount < 1 || requestedShardCount > teams.length) {
  throw new Error(`YD_REDUCED_SHARD_COUNT must be an integer from 1 to ${teams.length}`);
}

const shardSize = Math.ceil(teams.length / requestedShardCount);
const shards = [];
const allCandidates = [];
for (let start = 0; start < teams.length; start += shardSize) {
  const end = Math.min(teams.length, start + shardSize);
  const shardTeams = teams.slice(start, end);
  const candidates = shardTeams.flatMap((team) => team.entries.map(evaluate));
  allCandidates.push(...candidates);
  const sorted = [...candidates].sort(compareCandidates);
  const localBest = sorted[0];
  const localOptimalTieSet = sorted
    .filter((candidate) => canonicalUtilityTie(candidate.utility, localBest.utility))
    .map(candidateKey)
    .sort();
  shards.push(addressed({
    schemaVersion: 1,
    shardId: `reduced-${String(shards.length).padStart(3, "0")}`,
    scopeHash: scope.scopeHash,
    kernelHash: sha256(readFileSync(join(root, "tools/exact-global-solver/kernel.json"))),
    rosterHash: scope.roster.publicDataSha256,
    mechanicsHash: scope.mechanics.sha256,
    chartCorpusHash: scope.chartCorpus.benchmarkSha256,
    objectiveId: "yd-equal-chart-average-relative-utility-v1",
    evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
    arithmeticMethodologyVersion: "yd-canonical-micro-units-1.0.0",
    executionMode: "serial-reference-reduced-shard",
    range: { startInclusive: start, endExclusive: end },
    legalTeamSets: shardTeams.length,
    exactLeaves: shardTeams.length,
    prunedTeamSets: 0,
    maximumPrunedUpperCentralMicroUnits: null,
    leaderClassesEvaluated: new Set(shardTeams.flatMap((team) => team.entries.map((entry) => entry.leaderCardId))).size,
    localOptimalTieSet,
    elapsedMilliseconds: 0,
    peakMemoryBytes: 0,
  }, "sha256"));
}

const sorted = [...allCandidates].sort(compareCandidates);
const winner = sorted[0];
const optimalTieSet = sorted
  .filter((candidate) => canonicalUtilityTie(candidate.utility, winner.utility))
  .map(candidateKey)
  .sort();
const runnerUp = sorted.find((candidate) => candidateKey(candidate) !== candidateKey(winner));
const runRecord = addressed({
  schemaVersion: 1,
  kind: "yd-exact-optimality-run-v1",
  runRecordId: "yd-exact-reduced-shards-v1",
  scopeHash: scope.scopeHash,
  kernelHash: shards[0].kernelHash,
  rosterHash: scope.roster.publicDataSha256,
  mechanicsHash: scope.mechanics.sha256,
  chartCorpusHash: scope.chartCorpus.benchmarkSha256,
  objectiveId: "yd-equal-chart-average-relative-utility-v1",
  evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
  arithmeticMethodologyVersion: "yd-canonical-micro-units-1.0.0",
  executionMode: "serial-reference-reduced-shard",
  certificateEligible: false,
  parityEligible: false,
  resultClaim: "exhaustive-declared-scope-fixture",
  declaredEligibleMemberCardIds: [...new Set(teams.flatMap((team) => team.memberCardIds))].sort(),
  declaredEligibleLeaderOutfitCardIds: [...new Set(allCandidates.map((candidate) => candidate.leaderCardId))].sort(),
  declaredLegalTeamSets: teams.length,
  winner: {
    leaderCardId: winner.leaderCardId,
    memberCardIds: winner.memberCardIds,
    lowerMicroUnits: winner.utility.lower,
    centralMicroUnits: winner.utility.central,
    upperMicroUnits: winner.utility.upper,
    optimalTieSet,
  },
  runnerUp: runnerUp
    ? { key: candidateKey(runnerUp), centralMicroUnits: runnerUp.utility.central }
    : null,
  exactMicroUnitGap: runnerUp ? winner.utility.central - runnerUp.utility.central : null,
  shards,
}, "recordHash");

writeFileSync(
  join(root, "data/native/exact-optimizer-reduced-shard-run-v1.json"),
  `${JSON.stringify(runRecord, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  outputPath: "data/native/exact-optimizer-reduced-shard-run-v1.json",
  declaredLegalTeamSets: teams.length,
  shardCount: shards.length,
  winner: candidateKey(winner),
  optimalTieSetCount: optimalTieSet.length,
  certificateEligible: false,
}, null, 2));
