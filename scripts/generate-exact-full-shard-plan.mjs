import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import { mechanicsData } from "../packages/core/src/mechanics.ts";

const root = process.cwd();
const outputPath = join(root, "data/native/exact-optimizer-full-shard-plan-v1.json");
const targetTeamSets = Number(process.env.YD_EXACT_SHARD_TARGET_TEAM_SETS ?? 1_000_000);

if (!Number.isSafeInteger(targetTeamSets) || targetTeamSets < 1) {
  throw new Error("YD_EXACT_SHARD_TARGET_TEAM_SETS must be a positive safe integer");
}

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

function sha256Bytes(relativePath) {
  return createHash("sha256").update(readFileSync(join(root, relativePath))).digest("hex");
}

const mechanicsById = new Map(mechanicsData.cards.map((card) => [card.cardId, card]));
const eligible = [...exactOptimizerScope.eligibility.eligibleMemberCardIds].sort();
const groupsByTalent = new Map();
for (const cardId of eligible) {
  const card = mechanicsById.get(cardId);
  if (!card) throw new Error(`Unknown eligible Member card: ${cardId}`);
  const cards = groupsByTalent.get(card.talentId) ?? [];
  cards.push(cardId);
  groupsByTalent.set(card.talentId, cards);
}
const groups = [...groupsByTalent.entries()]
  .map(([talentId, cardIds]) => ({ talentId, cardIds: [...cardIds].sort() }))
  .sort((left, right) => left.talentId.localeCompare(right.talentId));

function countCompletions(groupIndex, slots, fiveStarBudget, cache) {
  if (fiveStarBudget < 0 || slots < 0) return 0;
  if (slots === 0) return 1;
  if (groups.length - groupIndex < slots) return 0;
  const key = `${groupIndex}:${slots}:${fiveStarBudget}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let total = countCompletions(groupIndex + 1, slots, fiveStarBudget, cache);
  for (const cardId of groups[groupIndex].cardIds) {
    const card = mechanicsById.get(cardId);
    total += countCompletions(
      groupIndex + 1,
      slots - 1,
      fiveStarBudget - (card.rarity === 5 ? 1 : 0),
      cache,
    );
  }
  cache.set(key, total);
  return total;
}

const countCache = new Map();
const declaredLegalTeamSets = countCompletions(0, 5, 5, countCache);
if (declaredLegalTeamSets !== 126_445_821) {
  throw new Error(`Full-scope legal-team count drifted: ${declaredLegalTeamSets}`);
}

/**
 * Produce contiguous ordinal ranges using the same stable talent-prefix order
 * as the certifying traversal: card choices before the skip branch, with
 * talent IDs and card IDs sorted ascending. A prefix is a resumable proof
 * cursor, not an evaluation result.
 */
const shards = [];
function emit(groupIndex, slots, fiveStarBudget, startInclusive, decisions, selectedMemberCardIds) {
  const legalTeamSets = countCompletions(groupIndex, slots, fiveStarBudget, countCache);
  if (legalTeamSets === 0) return startInclusive;
  if (legalTeamSets <= targetTeamSets || slots === 0 || groupIndex >= groups.length) {
    const prefix = {
      nextGroupIndex: groupIndex,
      slotsRemaining: slots,
      fiveStarBudget,
      decisions,
      selectedMemberCardIds: [...selectedMemberCardIds].sort(),
    };
    const range = {
      startInclusive,
      endExclusive: startInclusive + legalTeamSets,
    };
    const shard = {
      schemaVersion: 1,
      shardId: `full-${String(shards.length).padStart(5, "0")}`,
      scopeHash: exactOptimizerScope.scopeHash,
      kernelHash: sha256Bytes("tools/exact-global-solver/kernel.json"),
      rosterHash: exactOptimizerScope.roster.publicDataSha256,
      mechanicsHash: exactOptimizerScope.mechanics.sha256,
      chartCorpusHash: exactOptimizerScope.chartCorpus.benchmarkSha256,
      objectiveId: "yd-equal-chart-average-relative-utility-v1",
      evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
      arithmeticMethodologyVersion: "yd-canonical-micro-units-1.0.0",
      executionMode: "planned-full-scope-shard",
      status: "planned-not-evaluated",
      range,
      legalTeamSets,
      exactLeaves: 0,
      prunedTeamSets: 0,
      unsearchedTeamSets: legalTeamSets,
      prefix,
      resumeToken: null,
    };
    // The token needs the final shard ID; construct it after the object exists.
    shard.resumeToken = sha256({
      scopeHash: exactOptimizerScope.scopeHash,
      shardId: shard.shardId,
      range,
      prefix,
    });
    shards.push(shard);
    return range.endExclusive;
  }

  let cursor = startInclusive;
  const group = groups[groupIndex];
  for (const cardId of group.cardIds) {
    const card = mechanicsById.get(cardId);
    const childCount = countCompletions(
      groupIndex + 1,
      slots - 1,
      fiveStarBudget - (card.rarity === 5 ? 1 : 0),
      countCache,
    );
    if (childCount > 0) {
      cursor = emit(
        groupIndex + 1,
        slots - 1,
        fiveStarBudget - (card.rarity === 5 ? 1 : 0),
        cursor,
        [...decisions, { talentId: group.talentId, choice: cardId }],
        [...selectedMemberCardIds, cardId],
      );
    }
  }
  const skippedCount = countCompletions(groupIndex + 1, slots, fiveStarBudget, countCache);
  if (skippedCount > 0) {
    cursor = emit(
      groupIndex + 1,
      slots,
      fiveStarBudget,
      cursor,
      [...decisions, { talentId: group.talentId, choice: null }],
      selectedMemberCardIds,
    );
  }
  return cursor;
}

const end = emit(0, 5, 5, 0, [], []);
if (end !== declaredLegalTeamSets) {
  throw new Error(`Shard plan ended at ${end}; expected ${declaredLegalTeamSets}`);
}
if (shards.reduce((sum, shard) => sum + shard.legalTeamSets, 0) !== declaredLegalTeamSets) {
  throw new Error("Shard plan legal-team ranges do not reconcile");
}

const plan = {
  schemaVersion: 1,
  kind: "yd-exact-shard-plan-v1",
  planId: "yd-exact-full-roster-shards-v1",
  scopeHash: exactOptimizerScope.scopeHash,
  kernelHash: sha256Bytes("tools/exact-global-solver/kernel.json"),
  rosterHash: exactOptimizerScope.roster.publicDataSha256,
  mechanicsHash: exactOptimizerScope.mechanics.sha256,
  chartCorpusHash: exactOptimizerScope.chartCorpus.benchmarkSha256,
  objectiveId: "yd-equal-chart-average-relative-utility-v1",
  evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
  arithmeticMethodologyVersion: "yd-canonical-micro-units-1.0.0",
  executionMode: "planned-full-scope-shard",
  certificateEligible: false,
  resultClaim: "canonical-full-scope-shard-plan-only",
  declaredLegalTeamSets,
  eligibleMemberCardIds: eligible,
  eligibleLeaderOutfitCardIds: [...exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds].sort(),
  targetTeamSetsPerShard: targetTeamSets,
  enumerationOrder: {
    groups: "talentId-ascending",
    cards: "cardId-ascending",
    branchOrder: "choose-card-before-skip",
    legality: "one-card-per-talent-and-at-most-five-five-star-members",
  },
  rangeSemantics: "zero-based-contiguous-ordinal-over-legal-unordered-member-teams",
  resumeProtocol: {
    token: "sha256(scopeHash|shardId|range|prefix)",
    completionState: "pending|running|complete|failed",
    rule: "A resumed shard must retain the same scope, range, prefix, and token; partial output is never a certificate.",
  },
  shardCount: shards.length,
  shards,
};
plan.planHash = sha256(plan);
writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  outputPath: "data/native/exact-optimizer-full-shard-plan-v1.json",
  scopeHash: plan.scopeHash,
  declaredLegalTeamSets,
  targetTeamSetsPerShard: targetTeamSets,
  shardCount: shards.length,
  planHash: plan.planHash,
  certificateEligible: false,
}, null, 2));
