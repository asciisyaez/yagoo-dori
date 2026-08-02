import validationJson from "../../../data/native/relative-utility-model-v1.json";
import { z } from "zod";

import { mechanicsData } from "./mechanics";
import { nativeRankingData } from "./native-ranking-data";
import { rankingCorpusTimelineData } from "./ranking-corpus-timelines";
import {
  SCORE_KERNEL_RULE_STATES,
  SCORE_KERNEL_SOURCE_SNAPSHOT,
} from "./score-kernel";

const RuleIdArraySchema = z.array(z.string().min(1)).min(1).refine(
  (ids) => new Set(ids).size === ids.length,
  "Rule IDs must be unique",
);

export const RelativeUtilityModelValidationSchema = z
  .object({
    schemaVersion: z.literal(1),
    validationId: z.literal("yd-relative-utility-model-v1"),
    auditedAt: z.iso.date(),
    scope: z
      .object({
        objective: z.literal(
          "quantitative-reproducible-relative-ranking-and-team-selection",
        ),
        outputUnit: z.literal("parameter-equivalent-relative-unit"),
        absoluteLiveScoreClaimsAllowed: z.literal(false),
      })
      .strict(),
    evidenceSnapshot: z
      .object({
        officialSystemUrl: z.literal("https://www.hololive-dreams.com/en/system"),
        structuredRepository: z.url(),
        structuredCommit: z.string().regex(/^[a-f0-9]{40}$/),
        timelineSourceId: z.literal("holodori-best-chart-corpus-r51"),
        timelineApiRevision: z.literal(51),
        timelineParserRepository: z.url(),
        timelineParserCommit: z.string().regex(/^[a-f0-9]{40}$/),
      })
      .strict(),
    absoluteScoreAudit: z
      .object({
        status: z.literal("not-validated"),
        implementedKernelRuleIds: RuleIdArraySchema,
        unresolvedRuleIds: RuleIdArraySchema,
        conclusion: z.string().min(1),
      })
      .strict(),
    targetSelectionAudit: z
      .object({
        resolverStatus: z.literal("unknown"),
        structuredPriorityFieldAvailable: z.literal(false),
        rejectedSimpleResolvers: z
          .array(
            z.enum([
              "formation-order",
              "highest-target-stat",
              "highest-total-stat",
              "lowest-target-stat",
              "rarity",
              "level",
            ]),
          )
          .length(6),
        fixedPolicy: z.literal("enumerate-all-legal-capped-recipient-subsets"),
        centralPolicy: z.literal("guaranteed-minimum"),
        lowerBoundPolicy: z.literal("minimum-over-legal-recipient-subsets"),
        upperBoundPolicy: z.literal("maximum-over-legal-recipient-subsets"),
        claimsActualRecipients: z.literal(false),
      })
      .strict(),
    relativeModel: z
      .object({
        status: z.literal("implementation-validated-fixed-model"),
        methodologyVersion: z.literal("yd-native-utility-1.0.0"),
        rankingMethodologyVersion: z.literal("yd-native-ranking-2.1.0"),
        rankingSnapshotId: z.string().min(1),
        benchmarkId: z.string().min(1),
        benchmarkChartCount: z.literal(30),
        benchmarkReferenceChartCount: z.literal(21),
        benchmarkCurrentChartCount: z.literal(9),
        evaluatedCardCount: z.number().int().positive(),
        memberLensCount: z.literal(3),
        leaderOutfitLensCount: z.literal(3),
        minimumMatchedContextsPerCardLens: z.number().int().positive(),
        timedOrderAudit: z
          .object({
            methodologyVersion: z.literal("yd-formation-order-timed-corpus-1.0.0"),
            chartCount: z.literal(30),
            timedNoteEventCount: z.number().int().positive(),
            specialMarkerCount: z.literal(150),
            permutationsPerFormation: z.literal(120),
          })
          .strict(),
        invariants: z.array(z.string().min(1)).min(8).refine(
          (ids) => new Set(ids).size === ids.length,
          "Validation invariants must be unique",
        ),
      })
      .strict()
      .refine(
        (model) =>
          model.benchmarkReferenceChartCount + model.benchmarkCurrentChartCount ===
          model.benchmarkChartCount,
        "Benchmark segments must sum to the chart count",
      ),
    releaseDecision: z
      .object({
        relativeRankingAndTeamSelectionAllowed: z.literal(true),
        absoluteScoreEquationDisposition: z.literal(
          "claim-boundary-not-release-blocker",
        ),
        targetPriorityDisposition: z.literal(
          "bounded-uncertainty-not-release-blocker",
        ),
        remainingOptimizerRequirement: z.literal(
          "certified-full-roster-global-optimum",
        ),
      })
      .strict(),
  })
  .strict();

export type RelativeUtilityModelValidation = z.infer<
  typeof RelativeUtilityModelValidationSchema
>;

export const relativeUtilityModelValidation: RelativeUtilityModelValidation =
  RelativeUtilityModelValidationSchema.parse(validationJson as unknown);

function equalOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Cross-check the fixed relative-model audit against every versioned runtime
 * artifact it describes. This validates implementation coherence; it does not
 * convert the relative unit into an unverified absolute Live Score.
 */
export function assertRelativeUtilityModelValidationCurrent(): void {
  const audit = relativeUtilityModelValidation;
  const implementedRuleIds = SCORE_KERNEL_RULE_STATES.filter(
    (rule) => rule.status === "implemented-from-pinned-data",
  ).map((rule) => rule.id);
  const unresolvedRuleIds = SCORE_KERNEL_RULE_STATES.filter(
    (rule) => rule.status === "unresolved" && rule.blocksAbsoluteScore,
  ).map((rule) => rule.id);

  if (
    audit.evidenceSnapshot.structuredCommit !== mechanicsData.sourceSnapshot.commit ||
    audit.evidenceSnapshot.structuredCommit !== SCORE_KERNEL_SOURCE_SNAPSHOT.commit
  ) {
    throw new Error("Relative-model audit drifted from the pinned structured snapshot");
  }
  if (
    !equalOrderedValues(
      audit.absoluteScoreAudit.implementedKernelRuleIds,
      implementedRuleIds,
    ) ||
    !equalOrderedValues(audit.absoluteScoreAudit.unresolvedRuleIds, unresolvedRuleIds)
  ) {
    throw new Error("Relative-model audit drifted from the score-kernel rule boundary");
  }
  if (
    nativeRankingData.absoluteScoreAvailable ||
    nativeRankingData.methodologyVersion !== audit.relativeModel.rankingMethodologyVersion ||
    nativeRankingData.evaluatorVersion !== audit.relativeModel.methodologyVersion ||
    nativeRankingData.snapshotId !== audit.relativeModel.rankingSnapshotId ||
    nativeRankingData.benchmarkId !== audit.relativeModel.benchmarkId
  ) {
    throw new Error("Relative-model audit drifted from the native ranking snapshot");
  }
  const referenceCount = nativeRankingData.corpus.filter(
    (entry) => entry.segment === "reference",
  ).length;
  const currentCount = nativeRankingData.corpus.filter(
    (entry) => entry.segment === "current",
  ).length;
  if (
    nativeRankingData.corpus.length !== audit.relativeModel.benchmarkChartCount ||
    referenceCount !== audit.relativeModel.benchmarkReferenceChartCount ||
    currentCount !== audit.relativeModel.benchmarkCurrentChartCount ||
    nativeRankingData.lenses.length !== audit.relativeModel.memberLensCount ||
    nativeRankingData.leaderOutfitLenses.length !==
      audit.relativeModel.leaderOutfitLensCount
  ) {
    throw new Error("Relative-model audit drifted from the benchmark or lens set");
  }
  const allLenses = [
    ...nativeRankingData.lenses,
    ...nativeRankingData.leaderOutfitLenses,
  ];
  if (
    allLenses.some(
      (lens) =>
        lens.entries.length !== audit.relativeModel.evaluatedCardCount ||
        lens.entries.some(
          (entry) =>
            entry.evaluation.status !== "complete" ||
            entry.evaluation.matchedContexts <
              audit.relativeModel.minimumMatchedContextsPerCardLens,
        ),
    )
  ) {
    throw new Error("Relative-model audit drifted from complete matched evaluation coverage");
  }
  if (
    rankingCorpusTimelineData.source.apiRevision !==
      audit.evidenceSnapshot.timelineApiRevision ||
    rankingCorpusTimelineData.charts.length !==
      audit.relativeModel.timedOrderAudit.chartCount ||
    rankingCorpusTimelineData.counts.events !==
      audit.relativeModel.timedOrderAudit.timedNoteEventCount ||
    rankingCorpusTimelineData.counts.specialMarkers !==
      audit.relativeModel.timedOrderAudit.specialMarkerCount
  ) {
    throw new Error("Relative-model audit drifted from the exact timing corpus");
  }
}
