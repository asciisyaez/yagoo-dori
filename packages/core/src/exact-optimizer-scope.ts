import { createHash } from "node:crypto";

import scopeJson from "../../../data/native/exact-optimizer-scope-v1.json";
import { z } from "zod";

import { mechanicsData } from "./mechanics";
import { publicCards } from "./public-data";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const CardIdSchema = z.string().min(1);

export const ExactOptimizerScopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    scopeId: z.literal("yd-exact-full-roster-v1"),
    roster: z
      .object({
        sourceRepository: z.url(),
        sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
        publicDataPath: z.string().min(1),
        publicDataSha256: HashSchema,
        orderedCardIdsSha256: HashSchema,
        cardCount: z.literal(124),
      })
      .strict(),
    mechanics: z
      .object({
        path: z.string().min(1),
        sha256: HashSchema,
        evaluatorMethodologyVersion: z.literal("yd-native-utility-1.0.0"),
      })
      .strict(),
    songCorpus: z
      .object({ path: z.string().min(1), sha256: HashSchema, songCorpusVersion: z.string().min(1) })
      .strict(),
    chartCorpus: z
      .object({
        benchmarkPath: z.string().min(1),
        benchmarkId: z.string().min(1),
        benchmarkSha256: HashSchema,
        timelineProjectionPath: z.string().min(1),
        timelineProjectionSha256: HashSchema,
        difficulty: z.literal("expert"),
        weighting: z.literal("equal-per-chart"),
        chartCount: z.literal(30),
        referenceChartCount: z.literal(21),
        currentChartCount: z.literal(9),
        entries: z
          .array(
            z
              .object({
                chartKey: z.string().regex(/^m\d{4}:expert$/),
                expectedChartHash: z.string().regex(/^[a-f0-9]{32}$/),
                weightNumerator: z.literal(1),
                weightDenominator: z.literal(30),
              })
              .strict(),
          )
          .length(30),
      })
      .strict(),
    exactTimeline: z
      .object({
        sourceId: z.string().min(1),
        apiRevision: z.number().int().positive(),
        parserRepository: z.url(),
        parserCommit: z.string().regex(/^[a-f0-9]{40}$/),
        sourceManifestPath: z.string().min(1),
        sourceManifestSha256: HashSchema,
        fullTimelinePath: z.string().min(1),
        fullTimelineSha256: HashSchema,
        revision: z.string().min(1),
      })
      .strict(),
    eligibility: z
      .object({
        eligibleMemberCardIds: z.array(CardIdSchema).length(124),
        eligibleLeaderOutfitCardIds: z.array(CardIdSchema).length(124),
        fixedMemberCardIds: z.array(CardIdSchema).length(0),
        oshi: z.null(),
        maximumFiveStarMembers: z.literal(5),
      })
      .strict(),
    investment: z
      .object({
        layer: z.literal("one-copy-maximum"),
        duplicateOnlyBoosts: z.literal(false),
        bloomStageByCardId: z.record(CardIdSchema, z.number().int().min(0).max(5)),
      })
      .strict(),
    account: z
      .object({
        stateId: z.literal("declared-neutral-board-v1"),
        board: z
          .object({
            mode: z.literal("declared-neutral"),
            evidenceGrade: z.literal("verified"),
            evidenceRef: z.string().min(1),
          })
          .strict(),
        collectionBonus: z.literal("neutral-fixed"),
        connectEffects: z.literal("neutral-fixed"),
      })
      .strict(),
    seed: z.number().int(),
    evaluatorMethodologyVersion: z.literal("yd-native-utility-1.0.0"),
    arithmeticMethodologyVersion: z.literal("yd-canonical-micro-units-1.0.0"),
    objective: z
      .object({
        objectiveId: z.literal("yd-aggregate-central-lower-upper-micro-v1"),
        aggregation: z.literal("equal-chart-average"),
        utilityUnit: z.literal("parameter-equivalent-relative-unit"),
        precision: z.literal("signed-integer-six-decimal-micro-units"),
        comparator: z.tuple([
          z.literal("central"),
          z.literal("lower"),
          z.literal("upper"),
          z.literal("leaderCardId|sortedMemberCardIds"),
        ]),
        memberOrderForCertificate: z.literal("unordered-canonical-sorted-card-ids"),
        formationOrderIncluded: z.literal(false),
      })
      .strict(),
    formationOrderClaim: z
      .object({
        claimId: z.literal("yd-conditional-order-timing-regret-v1"),
        status: z.literal("conditional-on-selected-aggregate-optimal-team"),
        permutations: z.literal(120),
        methodologyVersion: z.literal("yd-formation-order-timed-corpus-1.0.0"),
        globallyCertified: z.literal(false),
      })
      .strict(),
    scopeHash: HashSchema,
  })
  .strict();

export type ExactOptimizerScope = z.infer<typeof ExactOptimizerScopeSchema>;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeExactOptimizerScopeHash(scope: Omit<ExactOptimizerScope, "scopeHash">): string {
  return createHash("sha256").update(canonicalize(scope), "utf8").digest("hex");
}

export function assertExactOptimizerScopeValid(
  scope: ExactOptimizerScope,
  cards: typeof publicCards,
  mechanics: typeof mechanicsData,
): void {
  const { scopeHash, ...scopeWithoutHash } = scope;
  if (computeExactOptimizerScopeHash(scopeWithoutHash) !== scopeHash) {
    throw new Error("Exact optimizer scope hash does not match its canonical manifest");
  }

  const publicCardIds = [...cards].map((card) => card.id).sort();
  if (
    scope.eligibility.eligibleMemberCardIds.join("|") !== publicCardIds.join("|") ||
    scope.eligibility.eligibleLeaderOutfitCardIds.join("|") !== publicCardIds.join("|")
  ) {
    throw new Error("Exact optimizer eligibility does not match the pinned public roster");
  }
  if (
    Object.keys(scope.investment.bloomStageByCardId).sort().join("|") !== publicCardIds.join("|") ||
    scope.roster.sourceCommit !== mechanics.sourceSnapshot.commit
  ) {
    throw new Error("Exact optimizer investment or roster source drifted from the mechanics catalog");
  }
}

const parsedScope = ExactOptimizerScopeSchema.parse(scopeJson);
assertExactOptimizerScopeValid(parsedScope, publicCards, mechanicsData);

export const exactOptimizerScope: ExactOptimizerScope = parsedScope;
