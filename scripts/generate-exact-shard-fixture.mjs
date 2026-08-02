import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}
function addressed(value, key) {
  const copy = { ...value };
  delete copy[key];
  return { ...value, [key]: sha256(copy) };
}

const scope = JSON.parse(readFileSync("data/native/exact-optimizer-scope-v1.json", "utf8"));
const kernelHash = createHash("sha256")
  .update(readFileSync("tools/exact-global-solver/kernel.json"))
  .digest("hex");
const rosterHash = scope.roster.publicDataSha256;
const mechanicsHash = scope.mechanics.sha256;
const chartCorpusHash = scope.chartCorpus.benchmarkSha256;
const methodology = {
  objectiveId: "yd-equal-chart-average-relative-utility-v1",
  evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
  arithmeticMethodologyVersion: "yd-canonical-micro-units-1.0.0",
  executionMode: "serial-fixture",
};
const shards = [
  {
    schemaVersion: 1,
    shardId: "fixture-000",
    scopeHash: scope.scopeHash,
    kernelHash,
    rosterHash,
    mechanicsHash,
    chartCorpusHash,
    ...methodology,
    range: { startInclusive: 0, endExclusive: 3 },
    legalTeamSets: 3,
    exactLeaves: 3,
    prunedTeamSets: 0,
    maximumPrunedUpperCentralMicroUnits: null,
    leaderClassesEvaluated: 1,
    localOptimalTieSet: [],
    elapsedMilliseconds: 1,
    peakMemoryBytes: 1,
  },
  {
    schemaVersion: 1,
    shardId: "fixture-001",
    scopeHash: scope.scopeHash,
    kernelHash,
    rosterHash,
    mechanicsHash,
    chartCorpusHash,
    ...methodology,
    range: { startInclusive: 3, endExclusive: 5 },
    legalTeamSets: 2,
    exactLeaves: 2,
    prunedTeamSets: 0,
    maximumPrunedUpperCentralMicroUnits: null,
    leaderClassesEvaluated: 1,
    localOptimalTieSet: [],
    elapsedMilliseconds: 1,
    peakMemoryBytes: 1,
  },
].map((shard) => addressed(shard, "sha256"));
const record = {
  schemaVersion: 1,
  kind: "yd-exact-optimality-run-v1",
  runRecordId: "yd-shard-verifier-fixture-v1",
    scopeHash: scope.scopeHash,
    kernelHash,
    rosterHash,
    mechanicsHash,
    chartCorpusHash,
    ...methodology,
  certificateEligible: false,
  parityEligible: false,
  resultClaim: "bounded-benchmark-fixture",
  declaredLegalTeamSets: 5,
  winner: { centralMicroUnits: 1_000_000 },
  shards,
};
writeFileSync("data/native/exact-optimizer-shard-fixture-v1.json", `${JSON.stringify(addressed(record, "recordHash"), null, 2)}\n`, "utf8");
