import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { countNativeLegalTeamSets } from "../packages/core/src/native-global-search.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import { mechanicsData } from "../packages/core/src/mechanics.ts";

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonicalize(value), "utf8")
    .digest("hex");
}

function sha256Bytes(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const path = process.argv[2];
if (!path || path === "--help") {
  console.error("Usage: node --import tsx/esm scripts/verify-exact-shard-plan.mjs <plan.json>");
  process.exit(path === "--help" ? 0 : 2);
}

const plan = JSON.parse(readFileSync(resolve(path), "utf8"));
const failures = [];
const fail = (message) => failures.push(message);
const root = process.cwd();

if (plan.schemaVersion !== 1 || plan.kind !== "yd-exact-shard-plan-v1") fail("unsupported plan schema");
if (plan.certificateEligible !== false) fail("a shard plan must never be certificate eligible");
if (plan.scopeHash !== exactOptimizerScope.scopeHash) fail("scope hash mismatch");
if (plan.kernelHash !== sha256Bytes(resolve(root, "tools/exact-global-solver/kernel.json"))) {
  fail("kernel hash mismatch");
}
for (const [field, expected] of [
  ["rosterHash", exactOptimizerScope.roster.publicDataSha256],
  ["mechanicsHash", exactOptimizerScope.mechanics.sha256],
  ["chartCorpusHash", exactOptimizerScope.chartCorpus.benchmarkSha256],
]) {
  if (plan[field] !== expected) fail(`${field} mismatch`);
}
if (!Number.isSafeInteger(plan.declaredLegalTeamSets) || plan.declaredLegalTeamSets < 0) {
  fail("invalid declaredLegalTeamSets");
}
if (!Array.isArray(plan.shards) || plan.shards.length !== plan.shardCount) fail("invalid shard list");

const recomputedCount = countNativeLegalTeamSets({
  eligibleMemberCardIds: [...exactOptimizerScope.eligibility.eligibleMemberCardIds],
  maxFiveStarMembers: 5,
});
if (recomputedCount !== plan.declaredLegalTeamSets) {
  fail(`declared legal-team count does not match independent count (${recomputedCount})`);
}

let expectedStart = 0;
let legalTotal = 0;
const shardIds = new Set();
for (const [index, shard] of (plan.shards ?? []).entries()) {
  const label = `shards[${index}]`;
  if (shardIds.has(shard.shardId)) fail(`${label}: duplicate shard ID`);
  shardIds.add(shard.shardId);
  if (shard.scopeHash !== plan.scopeHash) fail(`${label}: scope hash mismatch`);
  if (shard.kernelHash !== plan.kernelHash) fail(`${label}: kernel hash mismatch`);
  if (!shard.range || shard.range.startInclusive !== expectedStart) {
    fail(`${label}: expected contiguous start ${expectedStart}`);
  }
  if (!shard.range || !Number.isSafeInteger(shard.range.endExclusive) || shard.range.endExclusive <= expectedStart) {
    fail(`${label}: invalid range`);
  }
  const rangeLength = shard.range?.endExclusive - shard.range?.startInclusive;
  if (rangeLength !== shard.legalTeamSets) fail(`${label}: range length/count mismatch`);
  if (shard.exactLeaves !== 0 || shard.prunedTeamSets !== 0 || shard.unsearchedTeamSets !== shard.legalTeamSets) {
    fail(`${label}: plan-only counts must be exact=0, pruned=0, unsearched=legal`);
  }
  if (shard.status !== "planned-not-evaluated") fail(`${label}: unexpected execution status`);
  const expectedToken = sha256({
    scopeHash: plan.scopeHash,
    shardId: shard.shardId,
    range: shard.range,
    prefix: shard.prefix,
  });
  if (shard.resumeToken !== expectedToken) fail(`${label}: resume token mismatch`);
  expectedStart = shard.range.endExclusive;
  legalTotal += shard.legalTeamSets;
}
if (expectedStart !== plan.declaredLegalTeamSets) fail("ranges do not end at declared legal-team count");
if (legalTotal !== plan.declaredLegalTeamSets) fail("shard legal-team counts do not reconcile");
// The generator hashes the object before adding planHash. Recreate that exact
// shape rather than trusting the address stored in the document.
const planWithoutHash = { ...plan };
delete planWithoutHash.planHash;
if (plan.planHash !== sha256(planWithoutHash)) fail("planHash mismatch");

const result = {
  planPath: resolve(path),
  planHash: plan.planHash ?? null,
  verifiedStructure: failures.length === 0,
  certificateEligible: false,
  shardCount: plan.shardCount ?? null,
  declaredLegalTeamSets: plan.declaredLegalTeamSets ?? null,
  legalTeamSets: legalTotal,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
