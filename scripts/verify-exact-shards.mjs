import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

const path = process.argv[2];
const replayReduced = process.argv.includes("--replay-reduced");
if (!path || path === "--help") {
  console.error("Usage: node scripts/verify-exact-shards.mjs <run-record.json> [--replay-reduced]");
  process.exit(path === "--help" ? 0 : 2);
}

const recordPath = resolve(path);
const record = JSON.parse(readFileSync(recordPath, "utf8"));
const failures = [];
const fail = (message) => failures.push(message);

function sha256Bytes(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

if (record.schemaVersion !== 1 || record.kind !== "yd-exact-optimality-run-v1") {
  fail("unsupported run-record schema");
}
if (!/^[a-f0-9]{64}$/.test(record.scopeHash ?? "")) fail("invalid scopeHash");
if (!/^[a-f0-9]{64}$/.test(record.kernelHash ?? "")) fail("invalid kernelHash");
for (const field of ["rosterHash", "mechanicsHash", "chartCorpusHash"]) {
  if (!/^[a-f0-9]{64}$/.test(record[field] ?? "")) fail(`invalid ${field}`);
}
for (const field of ["objectiveId", "evaluatorMethodologyVersion", "arithmeticMethodologyVersion", "executionMode"]) {
  if (typeof record[field] !== "string" || record[field].length === 0) fail(`missing ${field}`);
}
if (!Number.isInteger(record.declaredLegalTeamSets) || record.declaredLegalTeamSets < 0) {
  fail("invalid declaredLegalTeamSets");
}
if (!record.winner || !Number.isInteger(record.winner.centralMicroUnits)) {
  fail("winner.centralMicroUnits must be an integer micro-unit value");
}
if (record.recordHash !== sha256(without(record, "recordHash"))) fail("recordHash mismatch");

try {
  const scope = JSON.parse(readFileSync(resolve("data/native/exact-optimizer-scope-v1.json"), "utf8"));
  if (record.scopeHash !== scope.scopeHash) fail("scopeHash does not match the checked-in scope manifest");
  if (record.kernelHash !== sha256Bytes(resolve("tools/exact-global-solver/kernel.json"))) {
    fail("kernelHash does not match the checked-in kernel bytes");
  }
  if (record.rosterHash !== scope.roster.publicDataSha256) fail("rosterHash does not match the pinned roster source");
  if (record.mechanicsHash !== scope.mechanics.sha256) fail("mechanicsHash does not match the pinned mechanics source");
  if (record.chartCorpusHash !== scope.chartCorpus.benchmarkSha256) fail("chartCorpusHash does not match the pinned chart benchmark");
} catch (error) {
  fail(`source-hash replay unavailable: ${error instanceof Error ? error.message : String(error)}`);
}

const shards = Array.isArray(record.shards) ? record.shards : [];
if (shards.length === 0) fail("run record must contain at least one shard");
let expectedStart = 0;
let legalTotal = 0;
let exactTotal = 0;
let prunedTotal = 0;
for (const [index, shard] of shards.entries()) {
  const label = `shards[${index}]`;
  if (shard.scopeHash !== record.scopeHash) fail(`${label}: scopeHash mismatch`);
  if (shard.kernelHash !== record.kernelHash) fail(`${label}: kernelHash mismatch`);
  for (const field of ["rosterHash", "mechanicsHash", "chartCorpusHash"]) {
    if (shard[field] !== record[field]) fail(`${label}: ${field} mismatch`);
  }
  for (const field of ["evaluatorMethodologyVersion", "arithmeticMethodologyVersion", "executionMode"]) {
    if (shard[field] !== record[field]) fail(`${label}: ${field} mismatch`);
  }
  if (!shard.range || shard.range.startInclusive !== expectedStart) {
    fail(`${label}: non-contiguous range; expected start ${expectedStart}`);
  }
  if (!shard.range || !Number.isInteger(shard.range.endExclusive) || shard.range.endExclusive <= expectedStart) {
    fail(`${label}: invalid range`);
  }
  if (shard.range) expectedStart = shard.range.endExclusive;
  for (const field of ["legalTeamSets", "exactLeaves", "prunedTeamSets"]) {
    if (!Number.isInteger(shard[field]) || shard[field] < 0) fail(`${label}: invalid ${field}`);
  }
  if (shard.exactLeaves + shard.prunedTeamSets !== shard.legalTeamSets) {
    fail(`${label}: exactLeaves + prunedTeamSets does not reconcile`);
  }
  if (shard.maximumPrunedUpperCentralMicroUnits !== null &&
      !Number.isInteger(shard.maximumPrunedUpperCentralMicroUnits)) {
    fail(`${label}: maximumPrunedUpperCentralMicroUnits must be integer or null`);
  }
  if (shard.maximumPrunedUpperCentralMicroUnits !== null &&
      shard.maximumPrunedUpperCentralMicroUnits >= record.winner.centralMicroUnits) {
    fail(`${label}: a pruned bound is not strictly below the winner`);
  }
  if (!Number.isInteger(shard.leaderClassesEvaluated) || shard.leaderClassesEvaluated < 0) {
    fail(`${label}: invalid leaderClassesEvaluated`);
  }
  if (!Number.isFinite(shard.elapsedMilliseconds) || shard.elapsedMilliseconds < 0) {
    fail(`${label}: invalid elapsedMilliseconds`);
  }
  if (!Number.isInteger(shard.peakMemoryBytes) || shard.peakMemoryBytes < 0) {
    fail(`${label}: invalid peakMemoryBytes`);
  }
  if (!Array.isArray(shard.localOptimalTieSet)) fail(`${label}: localOptimalTieSet must be an array`);
  if (shard.sha256 !== sha256(without(shard, "sha256"))) fail(`${label}: sha256 mismatch`);
  legalTotal += shard.legalTeamSets;
  exactTotal += shard.exactLeaves;
  prunedTotal += shard.prunedTeamSets;
}
if (expectedStart !== record.declaredLegalTeamSets) fail("shard ranges do not cover declared legal team count");
if (legalTotal !== record.declaredLegalTeamSets) fail("shard legal-team sum does not reconcile");
if (exactTotal + prunedTotal !== record.declaredLegalTeamSets) fail("exact/pruned sum does not reconcile");
if (record.certificateEligible === true && record.parityEligible !== true) {
  fail("certificateEligible cannot be true without parityEligible=true");
}
if (replayReduced) {
  try {
    const reducedReport = JSON.parse(readFileSync(resolve("data/native/exact-optimizer-reduced-parity-v1.json"), "utf8"));
    if (reducedReport.scopeHash !== record.scopeHash) fail("reduced replay scopeHash mismatch");
    if (reducedReport.parityEligible !== true || reducedReport.winnerMatches !== true) {
      fail("reduced replay report is not parity-eligible with a matching winner");
    }
    const winnerKey = `${record.winner.leaderCardId}|${[...record.winner.memberCardIds].sort().join("|")}`;
    const replayKey = `${reducedReport.tsWinner.leaderCardId}|${[...reducedReport.tsWinner.memberCardIds].sort().join("|")}`;
    if (winnerKey !== replayKey) fail("reduced replay winner key mismatch");
    if (record.winner.centralMicroUnits !== reducedReport.tsWinner.centralMicroUnits) {
      fail("reduced replay winner central micro-unit mismatch");
    }
  } catch (error) {
    fail(`reduced replay unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const result = {
  recordPath,
  recordHash: record.recordHash ?? null,
  certificateEligible: failures.length === 0 && record.certificateEligible === true,
  verifiedStructure: failures.length === 0,
  shardCount: shards.length,
  declaredLegalTeamSets: record.declaredLegalTeamSets ?? null,
  legalTeamSets: legalTotal,
  exactLeaves: exactTotal,
  prunedTeamSets: prunedTotal,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
