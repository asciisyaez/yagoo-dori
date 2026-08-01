import { z } from "zod";

import { SerializableIntervalSchema } from "./native-ranking-schema";

const FormationKindSchema = z.enum(["premium", "standard", "accessible-4-star"]);

function sameFiveCardIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === 5 &&
    new Set(right).size === 5 &&
    [...left].sort().join("\0") === [...right].sort().join("\0")
  );
}

const ProgressionLensIdSchema = z.enum([
  "level-cap-bloom-0-skill-1-connect-1",
  "level-cap-bloom-5-skill-2-connect-2",
]);

const ProgressionLensSchema = z.discriminatedUnion("id", [
  z
    .object({
      id: z.literal("level-cap-bloom-0-skill-1-connect-1"),
      label: z.literal("Level cap · Bloom 0 · skills Lv.1 · Connect Lv.1"),
      level: z.literal("card-level-cap"),
      bloomStage: z.literal(0),
      allParametersUpPermil: z.literal(0),
      activeSkillLevel: z.literal(1),
      passiveSkillLevel: z.literal(1),
      specialSkillLevel: z.literal(1),
      connectEffectLevel: z.literal(1),
    })
    .strict(),
  z
    .object({
      id: z.literal("level-cap-bloom-5-skill-2-connect-2"),
      label: z.literal("Level cap · Bloom 5 · skills Lv.2 · Connect Lv.2"),
      level: z.literal("card-level-cap"),
      bloomStage: z.literal(5),
      allParametersUpPermil: z.literal(100),
      activeSkillLevel: z.literal(2),
      passiveSkillLevel: z.literal(2),
      specialSkillLevel: z.literal(2),
      connectEffectLevel: z.literal(2),
    })
    .strict(),
]);

const FormationMemberSchema = z
  .object({
    slot: z.number().int().min(1).max(5),
    cardId: z.string().min(1),
  })
  .strict();

const RatingChartContextSchema = z
  .object({
    chartKey: z.string().regex(/^m\d{4}:expert$/),
    songId: z.string().regex(/^m\d{4}$/),
    songTitle: z.string().min(1),
    difficulty: z.literal("expert"),
    durationMilliseconds: z.number().int().positive(),
    noteCount: z.number().int().positive(),
    scoreRatingEligible: z.literal(true),
    leaderSingerMatched: z.literal(true),
    platform: z.literal("mobile"),
    chartFidelity: z.literal("aggregate"),
    noteTimeline: z.literal("unavailable"),
    specialMarkers: z.literal("unavailable"),
  })
  .strict()
  .refine((context) => context.chartKey === `${context.songId}:expert`, {
    message: "Guide chart key must match the rating song and Expert difficulty",
    path: ["chartKey"],
  });

const ReplacementSchema = z
  .object({
    replacedCardId: z.string().min(1),
    cardId: z.string().min(1),
    rarity: z.union([z.literal(4), z.literal(5)]),
    lossPercent: SerializableIntervalSchema,
    suggestedOrder: z.array(z.string().min(1)).length(5),
    orderStatus: z.enum(["modeled-general", "timed-corpus", "indeterminate"]),
    tradeoff: z
      .object({
        benefit: z.string().min(1),
        cost: z.string().min(1),
        activeCooldownDeltaMilliseconds: z.number().int(),
        specialDurationDeltaMilliseconds: z.number().int(),
        formationOrderChanged: z.boolean(),
        recipientApplicationsAdded: z.number().int().nonnegative(),
        recipientApplicationsRemoved: z.number().int().nonnegative(),
        possibleRecipientCardIdsAdded: z.array(z.string().min(1)),
        possibleRecipientCardIdsRemoved: z.array(z.string().min(1)),
      })
      .strict(),
  })
  .strict()
  .refine((replacement) => new Set(replacement.suggestedOrder).size === 5, {
    message: "Replacement order must contain five unique Members",
    path: ["suggestedOrder"],
  });

const RecipientSchema = z
  .object({
    source: z.enum(["leader", "passive"]),
    sourceCardId: z.string().min(1),
    effectGroupId: z.string().min(1),
    effectKind: z.string().min(1),
    valuePermil: z.number().finite(),
    resolution: z.enum(["resolved", "unresolved-enumerated-alternatives"]),
    commonToEveryAlternativeCardIds: z.array(z.string().min(1)),
    possibleCardIds: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((recipient, context) => {
    const possible = new Set(recipient.possibleCardIds);
    if (recipient.commonToEveryAlternativeCardIds.some((cardId) => !possible.has(cardId))) {
      context.addIssue({
        code: "custom",
        path: ["commonToEveryAlternativeCardIds"],
        message: "Cards common to every enumerated allocation must also be possible recipients",
      });
    }
  });

const ActiveSkillSummarySchema = z
  .object({
    cardId: z.string().min(1),
    activationProbabilityPermil: z.number().int().min(0).max(1_000),
    cooldownMilliseconds: z.number().int().positive(),
    durationMilliseconds: z.number().int().positive(),
    firstCheck: z.literal("one-cooldown-after-live-start"),
    chartNoteCoverage: z.null(),
  })
  .strict();

const SpecialSkillSummarySchema = z
  .object({
    slot: z.number().int().min(1).max(5),
    cardId: z.string().min(1),
    durationMilliseconds: z.number().int().positive(),
    markerTime: z.literal("unavailable"),
    startsAtMilliseconds: z.null(),
    endsAtMilliseconds: z.null(),
    chartNoteCoverage: z.null(),
    scoreSupportPermil: z.number().nonnegative(),
    activationRateUpPermil: z.number().nonnegative(),
  })
  .strict();

const LocalRefinementCoverageSchema = z
  .object({
    status: z.enum(["fixed-point", "cycle-guard", "declared-scope-exhausted"]),
    scope: z.literal("one-member-swap-or-leader-change"),
    selection: z.literal("strict-central-coordinate-ascent"),
    iterations: z.number().int().nonnegative(),
    candidatesScreened: z.number().int().nonnegative(),
    improvingCandidatesAudited: z.number().int().nonnegative(),
    formationOrdersAudited: z.number().int().nonnegative(),
    visitedFormations: z.number().int().positive(),
  })
  .strict();

const SearchCertificateSchema = z
  .object({
    mode: z.enum(["exhaustive-declared-scope", "heuristic"]),
    resultClaim: z.literal("recommended-under-provisional-relative-model"),
    teamSetsInScope: z.number().int().positive(),
    teamSetsConsidered: z.number().int().positive(),
    unsearchedTeamSets: z.number().int().nonnegative(),
    caveat: z.string().min(1),
    localRefinement: LocalRefinementCoverageSchema,
  })
  .strict()
  .superRefine((certificate, context) => {
    if (certificate.teamSetsConsidered + certificate.unsearchedTeamSets !== certificate.teamSetsInScope) {
      context.addIssue({
        code: "custom",
        path: ["teamSetsConsidered"],
        message: "Considered and unsearched team sets must equal the declared scope",
      });
    }
    if (certificate.mode === "exhaustive-declared-scope" && certificate.unsearchedTeamSets !== 0) {
      context.addIssue({
        code: "custom",
        path: ["unsearchedTeamSets"],
        message: "Exhaustive declared-scope coverage cannot leave team sets unsearched",
      });
    }
  });

const FormationOrderModelSchema = z
  .object({
    methodologyVersion: z.enum([
      "yd-formation-order-modeled-general-1.0.0",
      "yd-formation-order-timed-corpus-1.0.0",
    ]),
    corpusChartCount: z.union([z.literal(1), z.literal(30)]),
    markerLayoutCount: z.number().int().positive(),
    timingScenarioCount: z.number().int().positive(),
    permutationsChecked: z.literal(120),
    maxRegretPermil: z.number().finite().nonnegative(),
    meanRegretPermil: z.number().finite().nonnegative(),
    runnerUpGapPermil: z.number().finite().nonnegative(),
    winSharePermil: z.number().finite().min(0).max(1_000),
    exactTimelineAvailable: z.boolean(),
    noteTimelineAvailable: z.boolean().default(false),
    changesModeledTimingUtility: z.boolean().default(false),
    statement: z.string().min(1),
  })
  .strict()
  .superRefine((model, context) => {
    if (model.timingScenarioCount !== model.corpusChartCount * model.markerLayoutCount) {
      context.addIssue({
        code: "custom",
        path: ["timingScenarioCount"],
        message: "Timing scenarios must equal corpus charts multiplied by marker layouts",
      });
    }
    const timed = model.methodologyVersion === "yd-formation-order-timed-corpus-1.0.0";
    if (
      timed !== model.exactTimelineAvailable ||
      timed !== model.noteTimelineAvailable ||
      timed !== model.changesModeledTimingUtility ||
      (timed &&
        (model.markerLayoutCount !== 1 ||
          model.timingScenarioCount !== model.corpusChartCount))
    ) {
      context.addIssue({
        code: "custom",
        path: ["methodologyVersion"],
        message: "Formation-order timing flags must match the declared methodology",
      });
    }
  });

export const NativeGuideFormationSchema = z
  .object({
    kind: FormationKindSchema,
    label: z.string().min(1),
    progressionLens: ProgressionLensSchema,
    context: RatingChartContextSchema,
    leaderOutfitCardId: z.string().min(1),
    members: z.array(FormationMemberSchema).length(5),
    formationOrder: z.array(z.string().min(1)).length(5),
    orderStatus: z.enum(["modeled-general", "timed-corpus", "indeterminate"]),
    formationOrderModel: FormationOrderModelSchema,
    relativeUtility: SerializableIntervalSchema,
    staticParameters: z
      .object({
        base: SerializableIntervalSchema,
        leaderAndPassiveGain: SerializableIntervalSchema,
        effective: SerializableIntervalSchema,
      })
      .strict(),
    searchCertificate: SearchCertificateSchema,
    finalistsEvaluated: z.number().int().positive(),
    ordersAudited: z.number().int().positive().multipleOf(120),
    recipients: z.array(RecipientSchema),
    activeSkills: z.array(ActiveSkillSummarySchema).length(5),
    specialSkills: z.array(SpecialSkillSummarySchema).length(5),
    replacements: z.array(ReplacementSchema),
    investmentOrder: z.array(z.string().min(1)).length(5),
  })
  .strict()
  .superRefine((formation, context) => {
    if (formation.formationOrderModel.corpusChartCount !== 30) {
      context.addIssue({
        code: "custom",
        path: ["formationOrderModel", "corpusChartCount"],
        message: "Published general formations require the frozen 30-chart corpus",
      });
    }
    const memberIds = formation.members.map((member) => member.cardId);
    const memberSlots = formation.members.map((member) => member.slot);
    if (new Set(memberIds).size !== 5) {
      context.addIssue({ code: "custom", path: ["members"], message: "Formation Members must be unique" });
    }
    if (new Set(memberSlots).size !== 5) {
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "Formation Member slots must contain each slot from 1 through 5 exactly once",
      });
    }
    const memberBySlot = new Map(
      formation.members.map((member) => [member.slot, member.cardId] as const),
    );
    if (
      formation.formationOrder.some(
        (cardId, index) => memberBySlot.get(index + 1) !== cardId,
      )
    ) {
      context.addIssue({ code: "custom", path: ["formationOrder"], message: "Order must contain the five Members" });
    }
    if (!sameFiveCardIds(memberIds, formation.activeSkills.map((skill) => skill.cardId))) {
      context.addIssue({
        code: "custom",
        path: ["activeSkills"],
        message: "Active Skill summaries must contain each formation Member exactly once",
      });
    }
    const specialSlots = formation.specialSkills.map((skill) => skill.slot);
    if (
      new Set(specialSlots).size !== 5 ||
      formation.specialSkills.some(
        (skill) => memberBySlot.get(skill.slot) !== skill.cardId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["specialSkills"],
        message: "Special Skill summaries must match each formation Member and slot exactly once",
      });
    }
    if (!sameFiveCardIds(memberIds, formation.investmentOrder)) {
      context.addIssue({
        code: "custom",
        path: ["investmentOrder"],
        message: "Investment order must contain each formation Member exactly once",
      });
    }
    for (const [index, recipient] of formation.recipients.entries()) {
      if (recipient.source === "leader" && recipient.sourceCardId !== formation.leaderOutfitCardId) {
        context.addIssue({
          code: "custom",
          path: ["recipients", index, "sourceCardId"],
          message: "Leader contribution source must match the selected Leader Outfit card",
        });
      }
      if (recipient.source === "passive" && !memberIds.includes(recipient.sourceCardId)) {
        context.addIssue({
          code: "custom",
          path: ["recipients", index, "sourceCardId"],
          message: "Passive contribution source must be one of the five formation Members",
        });
      }
    }
    for (const [index, replacement] of formation.replacements.entries()) {
      if (!memberIds.includes(replacement.replacedCardId)) {
        context.addIssue({
          code: "custom",
          path: ["replacements", index, "replacedCardId"],
          message: "Replacement source must be one of the five selected Members",
        });
      }
      if (memberIds.includes(replacement.cardId)) {
        context.addIssue({
          code: "custom",
          path: ["replacements", index, "cardId"],
          message: "Replacement card cannot already be in the selected formation",
        });
      }
      const expectedAlternativeIds = memberIds
        .filter((cardId) => cardId !== replacement.replacedCardId)
        .concat(replacement.cardId)
        .sort();
      if ([...replacement.suggestedOrder].sort().join("\0") !== expectedAlternativeIds.join("\0")) {
        context.addIssue({
          code: "custom",
          path: ["replacements", index, "suggestedOrder"],
          message: "Replacement order must swap only the declared outgoing and incoming cards",
        });
      }
      if (
        replacement.tradeoff.possibleRecipientCardIdsAdded.some(
          (cardId) => !replacement.suggestedOrder.includes(cardId),
        ) ||
        replacement.tradeoff.possibleRecipientCardIdsRemoved.some(
          (cardId) => !memberIds.includes(cardId),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["replacements", index, "tradeoff"],
          message: "Replacement recipient changes must reference their respective legal formations",
        });
      }
    }
    const expectedLens = formation.kind === "premium"
      ? "level-cap-bloom-5-skill-2-connect-2"
      : "level-cap-bloom-0-skill-1-connect-1";
    if (formation.progressionLens.id !== expectedLens) {
      context.addIssue({
        code: "custom",
        path: ["progressionLens", "id"],
        message: `${formation.kind} must use its literal published progression state`,
      });
    }
  });

export const RatingSongComparisonSchema = z
  .object({
    songId: z.string().regex(/^m\d{4}$/),
    songTitle: z.string().min(1),
    chartKey: z.string().regex(/^m\d{4}:expert$/),
    difficulty: z.literal("expert"),
    durationMilliseconds: z.number().int().positive(),
    noteCount: z.number().int().positive(),
    scoreRatingEligible: z.literal(true),
    leaderSingerMatched: z.literal(true),
    platform: z.literal("mobile"),
    chartFidelity: z.literal("aggregate"),
    noteTimeline: z.literal("exact"),
    formationOrderTimelineFidelity: z.literal("exact-timed"),
    timelineEvidence: z.object({
      susSha256: z.string().regex(/^[a-f0-9]{64}$/),
      metadataSha256: z.string().regex(/^[a-f0-9]{64}$/),
      specialMarkerMicroseconds: z.array(z.number().int().nonnegative()).length(5),
      feverMarkerMicroseconds: z.object({
        chargeStart: z.number().int().nonnegative(),
        chargeEnd: z.number().int().nonnegative(),
        feverStart: z.number().int().nonnegative(),
        feverEnd: z.number().int().nonnegative(),
      }).strict(),
    }).strict(),
    leaderOutfitCardId: z.string().min(1),
    formationOrder: z.array(z.string().min(1)).length(5),
    orderStatus: z.enum(["modeled-general", "timed-corpus", "indeterminate"]),
    formationOrderModel: FormationOrderModelSchema,
    members: z.array(z.string().min(1)).length(5),
    relativeUtility: SerializableIntervalSchema,
    advantageOverReferencePercent: z.number().finite().positive().nullable(),
    changesReferenceFormation: z.boolean(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.chartKey !== `${entry.songId}:expert`) {
      context.addIssue({ code: "custom", path: ["chartKey"], message: "Comparison chart must match its rating song" });
    }
    if (
      entry.formationOrderModel.corpusChartCount !== 1 ||
      !entry.formationOrderModel.exactTimelineAvailable ||
      !entry.formationOrderModel.noteTimelineAvailable
    ) {
      context.addIssue({
        code: "custom",
        path: ["formationOrderModel"],
        message: "Rating-song placement requires one exact timed chart",
      });
    }
    if (entry.changesReferenceFormation !== (entry.advantageOverReferencePercent !== null)) {
      context.addIssue({
        code: "custom",
        path: ["advantageOverReferencePercent"],
        message: "Only a robust formation change may publish a modeled advantage",
      });
    }
    if ([...entry.members].sort().join("\0") !== [...entry.formationOrder].sort().join("\0")) {
      context.addIssue({ code: "custom", path: ["formationOrder"], message: "Comparison order must contain the five Members" });
    }
  });

const BenchmarkContextSchema = z
  .object({
    accountState: z.literal("frozen-neutral-public-benchmark"),
    platform: z.literal("mobile"),
    playMode: z.literal("manual"),
    judgement: z.literal("perfect"),
    fullCombo: z.literal(true),
    life: z.literal(1_000),
    board: z
      .object({ mode: z.literal("neutral"), relativeContribution: z.literal(0) })
      .strict(),
    collection: z
      .object({ memberUpgradeBonusPermyriad: z.literal(0) })
      .strict(),
    eventBonusPermil: z.literal(0),
    targetResolution: z.literal("unresolved-enumerated-alternatives"),
    scoreClaim: z.literal("relative-utility-only"),
  })
  .strict();

export const NativeGuideSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    anchorCardId: z.string().min(1),
    anchorTalentId: z.string().min(1),
    snapshotId: z.string().min(1),
    methodologyVersion: z.literal("yd-native-guide-1.2.0"),
    publicationState: z.literal("theorycraft-beta"),
    benchmark: BenchmarkContextSchema,
    ratingSongScope: z
      .object({
        singerTalentId: z.string().min(1),
        scoreRatingEligibleOnly: z.literal(true),
        leaderSingerMatchRequired: z.literal(true),
        difficulty: z.literal("expert"),
      })
      .strict(),
    formations: z.array(NativeGuideFormationSchema).length(3),
    ratingSongComparisons: z.array(RatingSongComparisonSchema).min(1),
  })
  .strict()
  .superRefine((guide, context) => {
    for (const kind of FormationKindSchema.options) {
      if (guide.formations.filter((formation) => formation.kind === kind).length !== 1) {
        context.addIssue({
          code: "custom",
          path: ["formations"],
          message: `Guide must contain exactly one ${kind} formation`,
        });
      }
    }
  });

export const NativeGuideDataSchema = z
  .object({
    schemaVersion: z.literal(5),
    generatedAt: z.iso.datetime({ offset: true }),
    rosterCommit: z.string().regex(/^[a-f0-9]{40}$/),
    guides: z.array(NativeGuideSchema).min(1),
  })
  .strict()
  .superRefine((data, context) => {
    for (const field of ["id", "slug", "anchorCardId"] as const) {
      const indexesByValue = new Map<string, number[]>();
      for (const [index, guide] of data.guides.entries()) {
        const indexes = indexesByValue.get(guide[field]) ?? [];
        indexes.push(index);
        indexesByValue.set(guide[field], indexes);
      }
      for (const indexes of indexesByValue.values()) {
        if (indexes.length < 2) continue;
        for (const index of indexes) {
          context.addIssue({
            code: "custom",
            path: ["guides", index, field],
            message: `Guide ${field} must be unique within the dataset`,
          });
        }
      }
    }
  });

export type NativeGuideFormation = z.infer<typeof NativeGuideFormationSchema>;
export type NativeGuide = z.infer<typeof NativeGuideSchema>;
export type NativeGuideData = z.infer<typeof NativeGuideDataSchema>;
