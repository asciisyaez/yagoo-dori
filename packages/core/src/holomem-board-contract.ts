import { z } from "zod";

import { mechanicsData, type MechanicsData } from "./mechanics";

export const HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION = 1 as const;
export const HOLOMEM_BOARD_DEFAULT_AMPLIFICATION_MODEL = "multiplier-total" as const;

export const CONNECT_SLOT_IDS = ["S-001", "S-002", "S-003", "S-004"] as const;

const IdSchema = z.string().min(1);
const NonnegativeIntegerSchema = z.number().int().nonnegative();
const NullableNonnegativeIntegerSchema = NonnegativeIntegerSchema.nullable();

export const HolomemBoardContractBloomStageSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const HolomemBoardContractPointModeSchema = z.enum(["estimate-from-rank", "direct"]);
export const HolomemBoardContractAmplificationModelSchema = z.enum([
  "multiplier-total",
  "multiplier-additional",
]);

const TeamMemberSchema = z
  .object({
    talentId: IdSchema,
    cardId: IdSchema,
    lens: z.enum(["one-copy-max", "max-potential"]),
  })
  .strict();

const TeamSchema = z
  .object({
    leader: TeamMemberSchema,
    members: z.array(TeamMemberSchema).length(5),
  })
  .strict()
  .superRefine((team, context) => {
    const memberTalents = new Set<string>();
    team.members.forEach((member, index) => {
      if (memberTalents.has(member.talentId)) {
        context.addIssue({
          code: "custom",
          path: ["members", index, "talentId"],
          message: `Team members must have unique talents: ${member.talentId}`,
        });
      }
      memberTalents.add(member.talentId);
    });
    if (!memberTalents.has(team.leader.talentId)) {
      context.addIssue({
        code: "custom",
        path: ["leader", "talentId"],
        message: "Team leader must be one of the five team members",
      });
    }
  });

const ConnectCandidateSchema = z
  .object({
    cardId: IdSchema,
    bloomStage: HolomemBoardContractBloomStageSchema,
  })
  .strict();

const ConnectPlacementsSchema = z.record(IdSchema, IdSchema);

const BoardStateSchema = z
  .object({
    rank: z.number().int().min(1).max(50),
    pointMode: HolomemBoardContractPointModeSchema,
    extraPoints: NonnegativeIntegerSchema,
    directPoints: NullableNonnegativeIntegerSchema,
    unlockedNodeGroupIds: z.array(IdSchema),
    connectPlacements: ConnectPlacementsSchema,
  })
  .strict()
  .superRefine((board, context) => {
    const groups = new Set<string>();
    board.unlockedNodeGroupIds.forEach((groupId, index) => {
      if (groups.has(groupId)) {
        context.addIssue({
          code: "custom",
          path: ["unlockedNodeGroupIds", index],
          message: `Duplicate unlocked node group: ${groupId}`,
        });
      }
      groups.add(groupId);
    });
    if (board.pointMode === "direct" && board.directPoints === null) {
      context.addIssue({
        code: "custom",
        path: ["directPoints"],
        message: "Direct point mode requires directPoints",
      });
    }
    const cardIds = new Set<string>();
    for (const [slot, cardId] of Object.entries(board.connectPlacements)) {
      if (!(CONNECT_SLOT_IDS as readonly string[]).includes(slot)) {
        context.addIssue({
          code: "custom",
          path: ["connectPlacements", slot],
          message: `Connect placement structure: invalid slot id ${slot}`,
        });
      }
      if (cardIds.has(cardId)) {
        context.addIssue({
          code: "custom",
          path: ["connectPlacements", slot],
          message: `Connect placement structure: card ${cardId} is placed more than once on this board`,
        });
      }
      cardIds.add(cardId);
    }
  });

export const HolomemBoardRequestSchema = z
  .object({
    schemaVersion: z.literal(HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION),
    rosterCommit: z.string().regex(/^[a-f0-9]{40}$/),
    playerLevel: z.number().int().nonnegative().nullable(),
    team: TeamSchema,
    connectCandidates: z.array(ConnectCandidateSchema),
    boards: z.record(IdSchema, BoardStateSchema),
    amplificationModel: HolomemBoardContractAmplificationModelSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const candidateIds = new Set<string>();
    request.connectCandidates.forEach((candidate, index) => {
      if (candidateIds.has(candidate.cardId)) {
        context.addIssue({
          code: "custom",
          path: ["connectCandidates", index, "cardId"],
          message: `Duplicate Connect candidate card: ${candidate.cardId}`,
        });
      }
      candidateIds.add(candidate.cardId);
    });

    const memberTalents = request.team.members.map((member) => member.talentId);
    const memberTalentSet = new Set(memberTalents);
    for (const talentId of memberTalents) {
      if (!(talentId in request.boards)) {
        context.addIssue({
          code: "custom",
          path: ["boards", talentId],
          message: `Request must carry a Board state for every team member: ${talentId}`,
        });
      }
    }
    for (const talentId of Object.keys(request.boards)) {
      if (!memberTalentSet.has(talentId)) {
        context.addIssue({
          code: "custom",
          path: ["boards", talentId],
          message: `Board state is not part of the declared team: ${talentId}`,
        });
      }
    }
    const placedCardOnBoard = new Map<string, string>();
    for (const [talentId, board] of Object.entries(request.boards)) {
      for (const cardId of Object.values(board.connectPlacements)) {
        const previousTalentId = placedCardOnBoard.get(cardId);
        if (previousTalentId !== undefined && previousTalentId !== talentId) {
          context.addIssue({
            code: "custom",
            path: ["boards", talentId, "connectPlacements"],
            message: `Connect placement structure: card ${cardId} cannot be placed on more than one Board`,
          });
        }
        placedCardOnBoard.set(cardId, talentId);
      }
    }
  });

const BoardNodeKindSchema = z.enum(["all-member", "leader", "content", "card", "connection"]);
const BoardValueClassSchema = z.enum([
  "flat",
  "permil",
  "unquantified",
  "connector",
  "inactive",
  "out-of-scope",
]);

// Machine-code grammar for structured effect identifiers: lowercase kebab ids
// only, so upstream display prose can never cross the worker boundary.
const MachineCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

const StructuredEffectSchema = z
  .object({
    kind: MachineCodeSchema.nullable(),
    trigger: MachineCodeSchema.nullable(),
    parameter: z.enum(["performance", "technique", "sense", "all"]).nullable(),
    flatValue: NullableNonnegativeIntegerSchema,
    valuePermil: NullableNonnegativeIntegerSchema,
  })
  .strict();

const SuggestionSchema = z
  .object({
    order: z.number().int().positive(),
    nodeGroupId: IdSchema,
    nodeId: IdSchema,
    kind: BoardNodeKindSchema,
    pointCost: NonnegativeIntegerSchema,
    valueMicroUnits: z.number().int().nonnegative().nullable(),
    valueClass: BoardValueClassSchema,
    appliesWhen: z.enum(["always", "while-leading"]).nullable(),
    pathParentGroupId: IdSchema,
    effect: StructuredEffectSchema,
  })
  .strict();

const LedgerSchema = z
  .object({
    rankIncome: NonnegativeIntegerSchema,
    extraPoints: NonnegativeIntegerSchema,
    totalAvailable: NonnegativeIntegerSchema,
    alreadySpent: NonnegativeIntegerSchema,
    remainingAvailable: z.number().int(),
    suggestedCost: NonnegativeIntegerSchema,
  })
  .strict();

const OverlapSchema = z
  .object({
    boardTalentId: IdSchema,
    slot: IdSchema,
    nodeGroupIds: z.array(IdSchema),
  })
  .strict();

const CompositionNodeSchema = z
  .object({
    nodeGroupId: IdSchema,
    nodeId: IdSchema,
    kind: BoardNodeKindSchema,
    valueClass: BoardValueClassSchema,
    valueMicroUnits: z.number().int().nonnegative().nullable(),
  })
  .strict();

const CompositionByKindSchema = z
  .object({
    kind: BoardNodeKindSchema,
    nodeCount: NonnegativeIntegerSchema,
    quantifiedMicroUnits: NonnegativeIntegerSchema,
  })
  .strict();

const CompositionSchema = z
  .object({
    nodeCount: NonnegativeIntegerSchema,
    quantifiedNodeCount: NonnegativeIntegerSchema,
    quantifiedMicroUnits: NonnegativeIntegerSchema,
    byKind: z.array(CompositionByKindSchema),
    nodes: z.array(CompositionNodeSchema),
  })
  .strict();

const PlacementSchema = z
  .object({
    boardTalentId: IdSchema,
    slot: IdSchema,
    cardId: IdSchema,
    connectLevel: z.union([z.literal(1), z.literal(2)]),
    extentId: IdSchema,
    amplificationPermil: NonnegativeIntegerSchema,
    gainMicroUnits: z.number().int(),
    overlapsWith: z.array(OverlapSchema),
    footprint: z
      .object({
        nodeGroupIds: z.array(IdSchema),
        unlockedNodeGroupIds: z.array(IdSchema),
        composition: CompositionSchema,
      })
      .strict(),
  })
  .strict();

const LockedSlotSchema = z
  .object({
    boardTalentId: IdSchema,
    slot: IdSchema,
    reasonCodes: z.array(z.enum(["player-level-gate", "slot-not-unlocked"])).min(1),
    requiredPlayerLevel: z.number().int().nonnegative().nullable(),
    playerLevel: z.number().int().nonnegative().nullable(),
  })
  .strict();

// The exact exclusion vocabulary the T4 Connect recommender emits — an enum,
// not free text, so no prose can flow through the reason channel.
export const CONNECT_EXCLUSION_REASON_CODES = [
  "duplicate-card-id",
  "star-3-no-connect-effect",
  "invalid-bloom-stage",
  "talent-mismatch",
  "unknown-card",
  "no-connect-effect",
  "assignment-not-selected",
  "no-positive-gain",
] as const;

const ExcludedCandidateSchema = z
  .object({
    cardId: IdSchema,
    reasonCodes: z.array(z.enum(CONNECT_EXCLUSION_REASON_CODES)).min(1),
  })
  .strict();

const ConnectResultSchema = z
  .object({
    assignment: z.literal("hungarian-complete"),
    unitConnectRule: z.literal("independent-user-confirmed"),
    amplificationModel: HolomemBoardContractAmplificationModelSchema,
    assignments: z.array(PlacementSchema),
    lockedSlots: z.array(LockedSlotSchema),
    excludedCandidates: z.array(ExcludedCandidateSchema),
  })
  .strict();

const ClaimSchema = z
  .object({
    kind: z.literal("bounded-suggestion"),
    conditionalOn: z.literal("current-team-and-declared-board-state"),
    adjacencyBasis: z.literal("derived-orthogonal-grid-adjacency"),
    stackingModel: z.literal("additive-envelope-not-jointly-attainable"),
    unitConnectRule: z.literal("independent-user-confirmed"),
    globallyCertified: z.literal(false),
  })
  .strict();

const PerMemberSchema = z
  .object({
    talentId: IdSchema,
    cardId: IdSchema,
    position: z.enum(["leader", "member"]),
    ledger: LedgerSchema,
    claimedMicroUnits: NonnegativeIntegerSchema,
    greedyBaselineMicroUnits: NonnegativeIntegerSchema,
    suggestions: z.array(SuggestionSchema),
  })
  .strict();

export const HolomemBoardResultSchema = z
  .object({
    schemaVersion: z.literal(HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION),
    claim: ClaimSchema,
    perMember: z.array(PerMemberSchema).length(5),
    connect: ConnectResultSchema,
    noteCodes: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)),
  })
  .strict()
  .superRefine((result, context) => {
    const memberTalents = new Set<string>();
    for (const [memberIndex, member] of result.perMember.entries()) {
      if (memberTalents.has(member.talentId)) {
        context.addIssue({
          code: "custom",
          path: ["perMember", memberIndex, "talentId"],
          message: `Duplicate per-member plan: ${member.talentId}`,
        });
      }
      memberTalents.add(member.talentId);

      const seenGroups = new Set<string>();
      let suggestedCost = 0;
      let claimedMicroUnits = 0;
      for (const [suggestionIndex, suggestion] of member.suggestions.entries()) {
        suggestedCost += suggestion.pointCost;
        claimedMicroUnits += suggestion.valueMicroUnits ?? 0;
        if (suggestion.order !== suggestionIndex + 1) {
          context.addIssue({
            code: "custom",
            path: ["perMember", memberIndex, "suggestions", suggestionIndex, "order"],
            message: "Unlock order must be contiguous and start at 1",
          });
        }
        if (seenGroups.has(suggestion.nodeGroupId)) {
          context.addIssue({
            code: "custom",
            path: ["perMember", memberIndex, "suggestions", suggestionIndex, "nodeGroupId"],
            message: `Unlock order repeats node group ${suggestion.nodeGroupId}`,
          });
        }
        seenGroups.add(suggestion.nodeGroupId);

        const isUnquantified = suggestion.valueClass === "unquantified";
        if ((suggestion.valueMicroUnits === null) !== isUnquantified) {
          context.addIssue({
            code: "custom",
            path: ["perMember", memberIndex, "suggestions", suggestionIndex, "valueMicroUnits"],
            message: "Value-class consistency: valueMicroUnits is null iff valueClass is unquantified",
          });
        }
        if (suggestion.valueClass === "connector" && suggestion.valueMicroUnits !== 0) {
          context.addIssue({
            code: "custom",
            path: ["perMember", memberIndex, "suggestions", suggestionIndex, "valueMicroUnits"],
            message: "Value-class consistency: connector valueMicroUnits must be zero",
          });
        }
        if (suggestion.appliesWhen === "while-leading" && (suggestion.kind !== "leader" || member.position !== "leader")) {
          context.addIssue({
            code: "custom",
            path: ["perMember", memberIndex, "suggestions", suggestionIndex, "appliesWhen"],
            message: "Value-class consistency: while-leading applies only to a leader plan",
          });
        }
      }
      if (member.ledger.suggestedCost !== suggestedCost) {
        context.addIssue({
          code: "custom",
          path: ["perMember", memberIndex, "ledger", "suggestedCost"],
          message: `Ledger arithmetic: suggestedCost must equal the sum of suggestion point costs (${suggestedCost})`,
        });
      }
      if (member.claimedMicroUnits !== claimedMicroUnits) {
        context.addIssue({
          code: "custom",
          path: ["perMember", memberIndex, "claimedMicroUnits"],
          message: `Objective reconciliation: claimedMicroUnits must equal the sum of suggestion values (${claimedMicroUnits})`,
        });
      }
      if (member.claimedMicroUnits < member.greedyBaselineMicroUnits) {
        context.addIssue({
          code: "custom",
          path: ["perMember", memberIndex, "claimedMicroUnits"],
          message: "Objective reconciliation: the suggested plan must not fall below the greedy baseline",
        });
      }
      if (member.ledger.remainingAvailable !== member.ledger.totalAvailable - member.ledger.alreadySpent) {
        context.addIssue({
          code: "custom",
          path: ["perMember", memberIndex, "ledger", "remainingAvailable"],
          message: "Ledger arithmetic: remainingAvailable must equal totalAvailable minus alreadySpent",
        });
      }
      // remainingAvailable may legitimately be negative: the rank-based income
      // estimate undershoots real achievement/shop income, so a user can
      // declare more unlocked than the estimate covers. An honest plan then
      // suggests nothing — cap against zero, not the negative remainder.
      if (member.ledger.suggestedCost > Math.max(0, member.ledger.remainingAvailable)) {
        context.addIssue({
          code: "custom",
          path: ["perMember", memberIndex, "ledger", "suggestedCost"],
          message: "Ledger arithmetic: suggestedCost must not exceed remainingAvailable",
        });
      }
    }

    const placementCards = new Set<string>();
    const placementPairs = new Set<string>();
    for (const [placementIndex, placement] of result.connect.assignments.entries()) {
      const pair = `${placement.boardTalentId}\u0000${placement.slot}`;
      if (!(CONNECT_SLOT_IDS as readonly string[]).includes(placement.slot)) {
        context.addIssue({
          code: "custom",
          path: ["connect", "assignments", placementIndex, "slot"],
          message: `Connect placement structure: invalid slot id ${placement.slot}`,
        });
      }
      if (placementCards.has(placement.cardId)) {
        context.addIssue({
          code: "custom",
          path: ["connect", "assignments", placementIndex, "cardId"],
          message: `Connect placement structure: card ${placement.cardId} is assigned more than once`,
        });
      }
      if (placementPairs.has(pair)) {
        context.addIssue({
          code: "custom",
          path: ["connect", "assignments", placementIndex],
          message: `Connect placement structure: board and slot pair is assigned more than once (${placement.boardTalentId}, ${placement.slot})`,
        });
      }
      placementCards.add(placement.cardId);
      placementPairs.add(pair);
    }
  });

export const HolomemBoardContractSchema = z
  .object({
    request: HolomemBoardRequestSchema,
    result: HolomemBoardResultSchema,
  })
  .strict()
  .superRefine((contract, context) => {
    const memberByTalent = new Map(contract.request.team.members.map((member) => [member.talentId, member]));
    const leaderTalentId = contract.request.team.leader.talentId;
    const seenResultTalents = new Set<string>();
    contract.result.perMember.forEach((member, index) => {
      const teamMember = memberByTalent.get(member.talentId);
      if (!teamMember) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "talentId"],
          message: `Per-member plan is not part of the declared team: ${member.talentId}`,
        });
        return;
      }
      seenResultTalents.add(member.talentId);
      if (member.cardId !== teamMember.cardId) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "cardId"],
          message: `Per-member plan card does not match the declared team card for ${member.talentId}`,
        });
      }
      const expectedPosition = member.talentId === leaderTalentId ? "leader" : "member";
      if (member.position !== expectedPosition) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "position"],
          message: `Per-member position must be ${expectedPosition} for ${member.talentId}`,
        });
      }
      const board = contract.request.boards[member.talentId];
      if (!board) return;
      // "start" is the T3 suggester's sentinel for a node whose cheapest path
      // parent is the Board root itself; the root (S-001) is implicitly
      // available on every board.
      const preUnlockedGroups = new Set(["start", "S-001", ...board.unlockedNodeGroupIds]);
      const earlierGroups = new Set<string>();
      member.suggestions.forEach((suggestion, suggestionIndex) => {
        const parentIsAvailable = preUnlockedGroups.has(suggestion.pathParentGroupId) || earlierGroups.has(suggestion.pathParentGroupId);
        if (!parentIsAvailable) {
          context.addIssue({
            code: "custom",
            path: ["result", "perMember", index, "suggestions", suggestionIndex, "pathParentGroupId"],
            message: `Unlock order prerequisite missing: ${suggestion.pathParentGroupId}`,
          });
        }
        earlierGroups.add(suggestion.nodeGroupId);
      });
      // alreadySpent is derived from the declared unlocks against the pinned
      // catalog costs, never trusted from the producer: an understated spend
      // would otherwise smuggle an unaffordable plan through the budget check.
      // Costs are uniform across a group's per-talent variants (validated by
      // data:validate), so any node row of the group prices it; the implicit
      // root S-001 is the unique zero-cost group either way.
      let expectedSpent = 0;
      for (const groupId of board.unlockedNodeGroupIds) {
        const cost = boardGroupPointCost(groupId);
        if (cost === null) {
          context.addIssue({
            code: "custom",
            path: ["request", "boards", member.talentId, "unlockedNodeGroupIds"],
            message: `Ledger arithmetic: unknown Board node group ${groupId}`,
          });
        } else {
          expectedSpent += cost;
        }
      }
      if (member.ledger.alreadySpent !== expectedSpent) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "ledger", "alreadySpent"],
          message: `Ledger arithmetic: alreadySpent must equal the catalog cost of the declared unlocks (${expectedSpent})`,
        });
      }
      const rankIncome = holomemRankIncome(board.rank);
      const expectedTotal = board.pointMode === "estimate-from-rank"
        ? rankIncome + board.extraPoints
        : board.directPoints;
      if (member.ledger.rankIncome !== rankIncome) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "ledger", "rankIncome"],
          message: `Ledger arithmetic: rankIncome must equal the cumulative holomem rank catalog income at rank ${board.rank} (${rankIncome})`,
        });
      }
      if (member.ledger.extraPoints !== board.extraPoints) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "ledger", "extraPoints"],
          message: "Ledger arithmetic: extraPoints must match the declared Board state",
        });
      }
      if (expectedTotal !== null && member.ledger.totalAvailable !== expectedTotal) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember", index, "ledger", "totalAvailable"],
          message: `Ledger arithmetic: totalAvailable must be ${expectedTotal} for the declared point mode`,
        });
      }
    });
    for (const member of contract.request.team.members) {
      if (!seenResultTalents.has(member.talentId)) {
        context.addIssue({
          code: "custom",
          path: ["result", "perMember"],
          message: `Result must contain one per-member plan for ${member.talentId}`,
        });
      }
    }
    const expectedAmplificationModel = contract.request.amplificationModel ?? HOLOMEM_BOARD_DEFAULT_AMPLIFICATION_MODEL;
    if (contract.result.connect.amplificationModel !== expectedAmplificationModel) {
      context.addIssue({
        code: "custom",
        path: ["result", "connect", "amplificationModel"],
        message: `Connect amplification model must match the request (${expectedAmplificationModel})`,
      });
    }
    if (contract.result.claim.unitConnectRule !== contract.result.connect.unitConnectRule) {
      context.addIssue({
        code: "custom",
        path: ["result", "connect", "unitConnectRule"],
        message: "Claim and Connect unitConnectRule literals must agree",
      });
    }
  });

export type HolomemBoardRequest = z.infer<typeof HolomemBoardRequestSchema>;
export type HolomemBoardResult = z.infer<typeof HolomemBoardResultSchema>;
export type HolomemBoardContract = z.infer<typeof HolomemBoardContractSchema>;
export type HolomemBoardContractBoardState = z.infer<typeof BoardStateSchema>;
export type HolomemBoardContractSuggestion = z.infer<typeof SuggestionSchema>;
export type HolomemBoardContractConnectResult = z.infer<typeof ConnectResultSchema>;

const groupPointCostCache = new Map<string, number | null>();

export function boardGroupPointCost(
  groupId: string,
  catalogs: MechanicsData["catalogs"] = mechanicsData.catalogs,
): number | null {
  if (catalogs === mechanicsData.catalogs && groupPointCostCache.has(groupId)) {
    return groupPointCostCache.get(groupId)!;
  }
  const node = catalogs.boardNodes.find((candidate) => candidate.groupId === groupId);
  const cost = node ? node.pointCost : null;
  if (catalogs === mechanicsData.catalogs) groupPointCostCache.set(groupId, cost);
  return cost;
}

export function holomemRankIncome(
  rank: number,
  catalogs: MechanicsData["catalogs"] = mechanicsData.catalogs,
): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 50) {
    throw new Error("Holomem Rank must be an integer between 1 and 50");
  }
  return catalogs.holomemRankPoints
    .filter((entry) => entry.rank <= rank)
    .reduce((total, entry) => total + entry.points, 0);
}

export const rankIncomeForHolomemRank = holomemRankIncome;

export function parseHolomemBoardContract(input: unknown): HolomemBoardContract {
  return HolomemBoardContractSchema.parse(input);
}

export function parseHolomemBoardResult(request: unknown, result: unknown): HolomemBoardResult {
  return HolomemBoardContractSchema.parse({ request, result }).result;
}
