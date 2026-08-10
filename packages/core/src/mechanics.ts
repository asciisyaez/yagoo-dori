import mechanicsJson from "../../../data/generated/holodori-mechanics.json";
import { z } from "zod";

const NullableTextSchema = z.string().min(1).nullable();
const SourceRefSchema = z.string().min(1);

const EvidenceSourceSchema = z.object({
  id: SourceRefSchema,
  kind: z.enum(["structured", "official", "corroboration"]),
  url: z.url(),
  upstreamVersion: z.string().min(1),
  retrievedAt: z.iso.date(),
  transformation: z.string().min(1),
});

const RuntimeRuleSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["verified", "corroborated", "unresolved"]),
  blocksScoring: z.boolean(),
  statement: z.string().min(1),
  sourceRefs: z.array(SourceRefSchema),
});

const ActiveEffectSchema = z.object({
  id: z.string().min(1),
  family: z.literal("active"),
  kind: z.enum([
    "score-up",
    "score-support",
    "activation-rate-up",
    "judgement-enhance",
    "life-recovery",
  ]),
  value: z.number().nonnegative().nullable(),
  unit: z.enum(["permil", "flat", "none"]),
  targetId: z.null(),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const PassiveEffectSchema = z.object({
  id: z.string().min(1),
  family: z.literal("passive"),
  kind: z.enum([
    "performance-up",
    "technique-up",
    "sense-up",
    "all-parameters-up",
    "active-skill-effect-up",
  ]),
  value: z.number().nonnegative(),
  unit: z.literal("permil"),
  targetId: z.string().min(1),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const EffectSchema = z.union([ActiveEffectSchema, PassiveEffectSchema]);

const TargetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["all", "self", "attribute", "character-group"]),
  attribute: z.enum(["cute", "pure", "happy"]).nullable(),
  characterGroupingId: z.string().min(1).nullable(),
  count: z.number().int().positive().nullable(),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const TriggerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "combo-at-least",
    "deck-attribute-count",
    "deck-character-group-count",
    "leader-character",
    "leader-character-group",
    "judgement-at-least",
    "life-at-least",
    "life-at-most",
    "music-character",
  ]),
  threshold: z.number().nonnegative().nullable(),
  attribute: z.enum(["cute", "pure", "happy"]).nullable(),
  characterGroupingId: z.string().min(1).nullable(),
  characterIds: z.array(z.string().min(1)),
  judgementType: z.string().min(1).nullable(),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const ApplicationSchema = z.object({
  channel: z.enum(["primary", "additional"]),
  combination: z.enum([
    "base",
    "conditional-base",
    "conditional-override",
    "additive",
    "conditional-additive",
  ]),
  effectGroupId: z.string().min(1),
  effect: EffectSchema.nullable(),
  triggerGroupId: z.string().min(1).nullable(),
  trigger: TriggerSchema.nullable(),
  target: TargetSchema.nullable(),
});

const SkillLevelSchema = z.object({
  kind: z.enum(["active", "passive", "special"]),
  level: z.number().int().positive(),
  description: NullableTextSchema,
  cooldownMilliseconds: z.number().int().nonnegative().nullable(),
  durationMilliseconds: z.number().int().nonnegative().nullable(),
  activationProbabilityPermil: z.number().int().min(0).max(1_000).nullable(),
  applications: z.array(ApplicationSchema).min(1),
});

const PotentialEffectSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  stage: z.number().int().min(1).max(5),
  kind: z.enum([
    "active-skill-level-up",
    "all-parameters-up",
    "special-skill-level-up",
    "passive-skill-level-up",
    "connect-effect-level-up",
  ]),
  value: z.number().int().nonnegative(),
  sourceRef: SourceRefSchema,
});

const ConnectEffectSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().positive(),
  kind: z.literal("skill-tree-effect-up"),
  extentId: z.string().min(1),
  valuePermil: z.number().int().nonnegative(),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const ConnectExtentSchema = z.object({
  id: z.string().min(1),
  positions: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
  sourceRef: SourceRefSchema,
});

const BoardEffectSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  value: z.number().nullable(),
  targetId: z.string().min(1).nullable(),
  passiveTriggerId: z.string().min(1).nullable(),
  characterTrigger: z.string().min(1),
  description: NullableTextSchema,
  liveActiveSkillId: z.string().min(1).nullable(),
  sourceRef: SourceRefSchema,
});

const BoardPassiveTriggerSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  characterIds: z.array(z.string().min(1)),
  characterGroupingId: z.string().min(1).nullable(),
  musicSingerType: z.string().min(1).nullable(),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const BoardTargetSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  characterId: z.string().min(1).nullable(),
  characterGroupingId: z.string().min(1).nullable(),
  description: NullableTextSchema,
  sourceRef: SourceRefSchema,
});

const BoardValueLimitSchema = z.object({
  kind: z.string().min(1),
  limit: z.number().nonnegative(),
  sourceRef: SourceRefSchema,
});

const BoardNodeItemCostSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  quantity: z.number().int().positive(),
}).strict();

const BoardNodeSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  number: z.number().int().positive(),
  kind: z.enum(["all-member", "leader", "content", "card", "connection"]),
  grade: z.number().int().positive(),
  effectId: z.string().min(1).nullable(),
  characterIds: z.array(z.string().min(1)),
  pointCost: z.number().int().nonnegative(),
  itemCosts: z.array(BoardNodeItemCostSchema),
  viewConditionGroupId: z.string().min(1).nullable(),
  unlockConditionGroupId: z.string().min(1).nullable(),
  autoSelectionPriority: z.number().int().nullable(),
  sourceRef: SourceRefSchema,
}).strict();

const BoardNodePositionSchema = z.object({
  treeModelId: z.string().min(1),
  nodeGroupId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  sourceRef: SourceRefSchema,
}).strict();

const BoardPointPoolSchema = z.object({
  id: z.string().min(1),
  talentId: z.string().min(1),
  name: NullableTextSchema,
  sourceRef: SourceRefSchema,
}).strict();

const HolomemRankPointSchema = z.object({
  rank: z.number().int().min(1).max(50),
  points: z.number().int().nonnegative(),
  sourceRef: SourceRefSchema,
}).strict();

const TalentBoardProfileSchema = z.object({
  talentId: z.string().min(1),
  treeModelId: z.enum(["tree-model-001", "tree-model-002", "tree-model-003", "tree-model-004"]),
  sourceRef: SourceRefSchema,
}).strict();

const BoardNodeConditionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("player-level-at-least"),
  threshold: z.number().int().positive(),
  sourceRef: SourceRefSchema,
}).strict();

const InvestmentStateSchema = z.object({
  level: z.number().int().positive(),
  activeSkillLevel: z.number().int().positive(),
  passiveSkillLevel: z.number().int().positive(),
  specialSkillLevel: z.number().int().positive(),
  connectEffectLevel: z.number().int().positive(),
  allParameterPermilUp: z.number().int().nonnegative(),
});

export const CardMechanicsSchema = z.object({
  cardId: z.string().min(1),
  talentId: z.string().min(1),
  rarity: z.union([z.literal(4), z.literal(5)]),
  sourceRef: SourceRefSchema,
  parameterDistributionPermil: z.object({
    performance: z.number().int().nonnegative(),
    technique: z.number().int().nonnegative(),
    sense: z.number().int().nonnegative(),
  }).refine(
    (distribution) =>
      distribution.performance + distribution.technique + distribution.sense === 1_000,
    { message: "Parameter distribution must total 1000 permil" },
  ),
  parameterSourceRefs: z.array(SourceRefSchema).length(3),
  progression: z.object({
    maxLevel: z.number().int().positive(),
    levelCurve: z.array(z.object({
      level: z.number().int().positive(),
      parameterBaseValue: z.number().int().positive(),
      liveDeckPowerPermyriadUp: z.number().int().nonnegative(),
    })).min(1),
    limitBreaks: z.array(z.object({
      limitBreakCount: z.number().int().nonnegative(),
      levelLimit: z.number().int().positive(),
    })).min(1),
    potential: z.array(PotentialEffectSchema).length(5),
    oneCopy: InvestmentStateSchema,
    maxPotential: InvestmentStateSchema,
    connectEffect: z.object({
      id: z.string().min(1),
      levels: z.array(ConnectEffectSchema).min(1),
    }),
  }),
  skills: z.object({
    active: z.array(SkillLevelSchema).min(1),
    passive: z.array(SkillLevelSchema).min(1),
    special: z.array(SkillLevelSchema).min(1),
  }),
  leaderOutfit: z.object({
    costumeId: z.string().min(1),
    talentId: z.string().min(1),
    leaderSkillId: z.string().min(1).nullable(),
    applications: z.array(ApplicationSchema).min(1),
    sourceRefs: z.array(SourceRefSchema).min(1),
  }),
  coverage: z.object({
    allReferencesMapped: z.boolean(),
    unresolvedReferenceIds: z.array(z.string().min(1)),
  }),
  unresolvedRuleIds: z.array(z.string().min(1)),
  scoringEligible: z.boolean(),
});

export const MechanicsDataSchema = z.object({
  schemaVersion: z.literal(1),
  methodologyVersion: z.literal("yd-mechanics-catalog-1.2.0"),
  retrievedAt: z.iso.date(),
  sourceSnapshot: z.object({
    repository: z.url(),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    masterVersion: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  evidenceSources: z.array(EvidenceSourceSchema).min(1),
  runtimeRules: z.array(RuntimeRuleSchema).min(1),
  catalogs: z.object({
    activeEffects: z.array(ActiveEffectSchema),
    passiveEffects: z.array(PassiveEffectSchema),
    targets: z.array(TargetSchema),
    triggers: z.array(TriggerSchema),
    potentialEffects: z.array(PotentialEffectSchema),
    connectEffects: z.array(ConnectEffectSchema),
    connectExtents: z.array(ConnectExtentSchema),
    boardEffects: z.array(BoardEffectSchema),
    boardPassiveTriggers: z.array(BoardPassiveTriggerSchema),
    boardTargets: z.array(BoardTargetSchema),
    boardValueLimits: z.array(BoardValueLimitSchema),
    boardNodes: z.array(BoardNodeSchema),
    boardNodePositions: z.array(BoardNodePositionSchema),
    boardPointPools: z.array(BoardPointPoolSchema),
    talentBoardProfiles: z.array(TalentBoardProfileSchema),
    holomemRankPoints: z.array(HolomemRankPointSchema),
    boardNodeConditions: z.array(BoardNodeConditionSchema),
  }),
  cards: z.array(CardMechanicsSchema).min(1),
  coverage: z.object({
    cards: z.number().int().positive(),
    mappedCards: z.number().int().nonnegative(),
    unresolvedReferences: z.array(z.string().min(1)),
  }),
}).superRefine((data, context) => {
  const sourceIds = new Set(data.evidenceSources.map((source) => source.id));
  const ruleById = new Map(data.runtimeRules.map((rule) => [rule.id, rule]));
  const effectIds = new Set([
    ...data.catalogs.activeEffects.map((effect) => effect.id),
    ...data.catalogs.passiveEffects.map((effect) => effect.id),
  ]);
  const triggerIds = new Set(data.catalogs.triggers.map((trigger) => trigger.id));
  const targetIds = new Set(data.catalogs.targets.map((target) => target.id));
  const extentIds = new Set(data.catalogs.connectExtents.map((extent) => extent.id));
  const boardNodeConditionIds = new Set(data.catalogs.boardNodeConditions.map((condition) => condition.id));
  const boardNodeGroups = new Set(data.catalogs.boardNodes.map((node) => node.groupId));
  const boardPositionModels = new Set(data.catalogs.boardNodePositions.map((position) => position.treeModelId));
  const requireSource = (sourceRef: string, path: (string | number)[]) => {
    if (!sourceIds.has(sourceRef)) {
      context.addIssue({ code: "custom", path, message: `Unknown source ${sourceRef}` });
    }
  };

  for (const source of data.evidenceSources) {
    if (source.id.length === 0) {
      context.addIssue({ code: "custom", path: ["evidenceSources"], message: "Source IDs cannot be empty" });
    }
  }
  for (const rule of data.runtimeRules) {
    for (const sourceRef of rule.sourceRefs) {
      requireSource(sourceRef, ["runtimeRules", rule.id]);
    }
  }
  const sourceLinkedCatalogs = [
    ...data.catalogs.activeEffects,
    ...data.catalogs.passiveEffects,
    ...data.catalogs.targets,
    ...data.catalogs.triggers,
    ...data.catalogs.potentialEffects,
    ...data.catalogs.connectEffects,
    ...data.catalogs.connectExtents,
    ...data.catalogs.boardEffects,
    ...data.catalogs.boardPassiveTriggers,
    ...data.catalogs.boardTargets,
    ...data.catalogs.boardValueLimits,
    ...data.catalogs.boardNodes,
    ...data.catalogs.boardNodePositions,
    ...data.catalogs.boardPointPools,
    ...data.catalogs.talentBoardProfiles,
    ...data.catalogs.holomemRankPoints,
    ...data.catalogs.boardNodeConditions,
  ];
  for (const entry of sourceLinkedCatalogs) {
    requireSource(entry.sourceRef, [
      "catalogs",
      "id" in entry ? entry.id : "kind" in entry ? entry.kind : entry.sourceRef,
    ]);
  }
  for (const effect of data.catalogs.passiveEffects) {
    if (!targetIds.has(effect.targetId)) {
      context.addIssue({ code: "custom", path: ["catalogs", "passiveEffects", effect.id], message: `Unknown target ${effect.targetId}` });
    }
  }
  for (const effect of data.catalogs.connectEffects) {
    if (!extentIds.has(effect.extentId)) {
      context.addIssue({ code: "custom", path: ["catalogs", "connectEffects", effect.id], message: `Unknown extent ${effect.extentId}` });
    }
  }

  for (const node of data.catalogs.boardNodes) {
    for (const conditionId of [node.viewConditionGroupId, node.unlockConditionGroupId]) {
      if (conditionId && !boardNodeConditionIds.has(conditionId)) {
        context.addIssue({
          code: "custom",
          path: ["catalogs", "boardNodes", node.id],
          message: `Unknown board node condition ${conditionId}`,
        });
      }
    }
  }

  const positionsByGroup = new Map<string, typeof data.catalogs.boardNodePositions>();
  for (const position of data.catalogs.boardNodePositions) {
    const positions = positionsByGroup.get(position.nodeGroupId) ?? [];
    positions.push(position);
    positionsByGroup.set(position.nodeGroupId, positions);
  }
  for (const [groupId, positions] of positionsByGroup) {
    if (!boardNodeGroups.has(groupId)) {
      context.addIssue({
        code: "custom",
        path: ["catalogs", "boardNodePositions", groupId],
        message: `Unknown board node group ${groupId}`,
      });
    }
    if (positions.length !== 4 || new Set(positions.map((position) => position.treeModelId)).size !== 4) {
      context.addIssue({
        code: "custom",
        path: ["catalogs", "boardNodePositions", groupId],
        message: "Every board node group must have one position in each tree model",
      });
    }
  }
  for (const groupId of boardNodeGroups) {
    const positions = data.catalogs.boardNodePositions.filter((position) => position.nodeGroupId === groupId);
    if (positions.length !== boardPositionModels.size || positions.length !== 4) {
      context.addIssue({
        code: "custom",
        path: ["catalogs", "boardNodePositions", groupId],
        message: "Every board node group must have four positions",
      });
    }
  }
  const poolTalentIds = data.catalogs.boardPointPools.map((pool) => pool.talentId);
  if (new Set(poolTalentIds).size !== poolTalentIds.length) {
    context.addIssue({
      code: "custom",
      path: ["catalogs", "boardPointPools"],
      message: "Board point pool talent IDs must be unique",
    });
  }
  const ranks = data.catalogs.holomemRankPoints.map((entry) => entry.rank);
  const orderedRanks = [...new Set(ranks)].sort((left, right) => left - right);
  if (
    ranks.length !== 50 ||
    orderedRanks.length !== 50 ||
    orderedRanks.some((rank, index) => rank !== index + 1)
  ) {
    context.addIssue({
      code: "custom",
      path: ["catalogs", "holomemRankPoints"],
      message: "Holomem Rank point rows must be contiguous from 1 through 50",
    });
  }

  const seenCards = new Set<string>();
  for (const [cardIndex, card] of data.cards.entries()) {
    if (seenCards.has(card.cardId)) {
      context.addIssue({ code: "custom", path: ["cards", cardIndex, "cardId"], message: "Card IDs must be unique" });
    }
    seenCards.add(card.cardId);
    requireSource(card.sourceRef, ["cards", cardIndex, "sourceRef"]);
    for (const sourceRef of card.parameterSourceRefs) {
      requireSource(sourceRef, ["cards", cardIndex, "parameterSourceRefs"]);
    }
    for (const sourceRef of card.leaderOutfit.sourceRefs) {
      requireSource(sourceRef, ["cards", cardIndex, "leaderOutfit", "sourceRefs"]);
    }
    for (const potential of card.progression.potential) {
      requireSource(potential.sourceRef, ["cards", cardIndex, "progression", "potential"]);
    }
    for (const connect of card.progression.connectEffect.levels) {
      requireSource(connect.sourceRef, ["cards", cardIndex, "progression", "connectEffect"]);
    }

    const applications = [
      ...card.skills.active.flatMap((level) => level.applications),
      ...card.skills.passive.flatMap((level) => level.applications),
      ...card.skills.special.flatMap((level) => level.applications),
      ...card.leaderOutfit.applications,
    ];
    for (const application of applications) {
      if (!effectIds.has(application.effectGroupId)) {
        context.addIssue({ code: "custom", path: ["cards", cardIndex], message: `Unknown effect ${application.effectGroupId}` });
      }
      if (application.triggerGroupId && !triggerIds.has(application.triggerGroupId)) {
        context.addIssue({ code: "custom", path: ["cards", cardIndex], message: `Unknown trigger ${application.triggerGroupId}` });
      }
    }

    if (card.scoringEligible) {
      if (!card.coverage.allReferencesMapped || card.coverage.unresolvedReferenceIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["cards", cardIndex, "scoringEligible"],
          message: "A scored card cannot contain unresolved references",
        });
      }
      const blockers = card.unresolvedRuleIds.filter((id) => {
        const rule = ruleById.get(id);
        return !rule || (rule.status === "unresolved" && rule.blocksScoring);
      });
      if (blockers.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["cards", cardIndex, "scoringEligible"],
          message: `A scored card cannot depend on unresolved rules: ${blockers.join(", ")}`,
        });
      }
    }
  }

  if (data.coverage.cards !== data.cards.length) {
    context.addIssue({ code: "custom", path: ["coverage", "cards"], message: "Coverage card count mismatch" });
  }
  const mappedCards = data.cards.filter((card) => card.coverage.allReferencesMapped).length;
  if (data.coverage.mappedCards !== mappedCards) {
    context.addIssue({ code: "custom", path: ["coverage", "mappedCards"], message: "Mapped card count mismatch" });
  }
});

export type CardMechanics = z.infer<typeof CardMechanicsSchema>;
export type MechanicsData = z.infer<typeof MechanicsDataSchema>;

export const mechanicsData: MechanicsData = MechanicsDataSchema.parse(mechanicsJson);
export const mechanicsCardById = new Map(
  mechanicsData.cards.map((card) => [card.cardId, card]),
);

export type ParameterSet = {
  performance: number;
  technique: number;
  sense: number;
};

export function calculateCardParameters(
  card: CardMechanics,
  level: number,
  allParameterPermilUp = 0,
): ParameterSet {
  const levelRow = card.progression.levelCurve.find((candidate) => candidate.level === level);
  if (!levelRow) {
    throw new Error(`${card.cardId} has no level ${level} parameter row`);
  }
  if (!Number.isInteger(allParameterPermilUp) || allParameterPermilUp < 0) {
    throw new Error("allParameterPermilUp must be a nonnegative integer");
  }
  const multiplier = 1 + allParameterPermilUp / 1_000;
  return {
    performance: Math.ceil(
      levelRow.parameterBaseValue * card.parameterDistributionPermil.performance / 1_000 * multiplier,
    ),
    technique: Math.ceil(
      levelRow.parameterBaseValue * card.parameterDistributionPermil.technique / 1_000 * multiplier,
    ),
    sense: Math.ceil(
      levelRow.parameterBaseValue * card.parameterDistributionPermil.sense / 1_000 * multiplier,
    ),
  };
}

export function assertScoringEligibleCard(card: CardMechanics): asserts card is CardMechanics {
  if (!card.coverage.allReferencesMapped || card.coverage.unresolvedReferenceIds.length > 0) {
    throw new Error(
      `${card.cardId} has unresolved mechanics references: ${card.coverage.unresolvedReferenceIds.join(", ")}`,
    );
  }
  const ruleById = new Map(mechanicsData.runtimeRules.map((rule) => [rule.id, rule]));
  const blockers = card.unresolvedRuleIds.filter((id) => {
    const rule = ruleById.get(id);
    return !rule || (rule.status === "unresolved" && rule.blocksScoring);
  });
  if (blockers.length > 0) {
    throw new Error(`${card.cardId} is not scoring eligible: ${blockers.join(", ")}`);
  }
  if (!card.scoringEligible) {
    throw new Error(`${card.cardId} is not marked scoring eligible`);
  }
}
