import {
  HolomemBoardContractSchema,
  HolomemBoardRequestSchema,
  HolomemBoardResultSchema,
  boardGroupPointCost,
  holomemRankIncome,
  type HolomemBoardRequest,
  type HolomemBoardResult,
} from "./holomem-board-contract";
import {
  recommendHolomemBoardConnect,
  type HolomemBoardConnectBoard,
} from "./holomem-board-connect";
import { mechanicsData, type MechanicsData } from "./mechanics";
import {
  BOARD_SUGGESTER_BEAM_WIDTH,
  suggestHolomemBoardNodes,
  type BoardFocusPosition,
  type HolomemBoardSuggestion,
} from "./holomem-board-suggester";

const DEFAULT_PLAYER_LEVEL = 50;

type BoardCatalogs = MechanicsData["catalogs"];

function deriveAlreadySpent(unlockedNodeGroupIds: readonly string[], catalogs: BoardCatalogs): number {
  return unlockedNodeGroupIds.reduce((total, groupId) => {
    const cost = boardGroupPointCost(groupId, catalogs);
    if (cost === null) throw new Error(`Unknown Board node group: ${groupId}`);
    return total + cost;
  }, 0);
}

function totalAvailable(board: HolomemBoardRequest["boards"][string], rankIncome: number): number {
  if (board.pointMode === "estimate-from-rank") return rankIncome + board.extraPoints;
  if (board.directPoints === null) throw new Error("Direct point mode requires directPoints");
  return board.directPoints;
}

function zeroRankIncomeCatalogs(catalogs: BoardCatalogs): BoardCatalogs {
  return {
    ...catalogs,
    holomemRankPoints: catalogs.holomemRankPoints.map((entry) => ({ ...entry, points: 0 })),
  };
}

function parameterForEffectKind(kind: string | null): "performance" | "technique" | "sense" | "all" | null {
  if (kind === null) return null;
  if (kind.startsWith("performance-")) return "performance";
  if (kind.startsWith("technique-")) return "technique";
  if (kind.startsWith("sense-")) return "sense";
  if (kind.startsWith("all-parameter-")) return "all";
  return null;
}

function structuredEffect(
  suggestion: HolomemBoardSuggestion["suggestedUnlocks"][number],
  planned: HolomemBoardSuggestion,
  catalogs: BoardCatalogs,
) {
  const objective = planned.objective.objectiveByGroupId.get(suggestion.nodeGroupId);
  if (!objective) throw new Error(`Board objective is missing ${suggestion.nodeGroupId}`);
  const effect = objective.effectId === null
    ? null
    : catalogs.boardEffects.find((candidate) => candidate.id === objective.effectId) ?? null;
  const effectKind = objective.effectKind;
  const value = effect?.value;
  const isPermil = effectKind?.endsWith("-permil-up") === true;
  return {
    kind: effectKind,
    trigger: effect?.characterTrigger ?? null,
    parameter: parameterForEffectKind(effectKind),
    flatValue: !isPermil && typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null,
    valuePermil: isPermil && typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null,
  };
}

function suggestForBoard(
  request: HolomemBoardRequest,
  talentId: string,
  focusPosition: BoardFocusPosition,
): {
  planned: HolomemBoardSuggestion;
  totalAvailable: number;
  alreadySpent: number;
  rankIncome: number;
} {
  const board = request.boards[talentId];
  if (!board) throw new Error(`Board state is missing for ${talentId}`);
  const catalogs = mechanicsData.catalogs;
  const rankIncome = holomemRankIncome(board.rank, catalogs);
  const total = totalAvailable(board, rankIncome);
  const alreadySpent = deriveAlreadySpent(board.unlockedNodeGroupIds, catalogs);
  const available = Math.max(0, total - alreadySpent);
  const playerLevel = request.playerLevel ?? DEFAULT_PLAYER_LEVEL;

  if (total < alreadySpent) {
    return {
      planned: {
        claim: "bounded-search",
        stackingModel: "additive-envelope-not-jointly-attainable",
        budget: {
          holomemRank: board.rank,
          rankPointIncome: board.pointMode === "direct" ? 0 : rankIncome,
          extraPointsOwned: board.pointMode === "direct" ? total : board.extraPoints,
          totalBudget: total,
          alreadySpent,
          available,
        },
        boardDiagnostics: { declaredStateConsistentWithDerivedAdjacency: true },
        objective: {
          stackingModel: "additive-envelope-not-jointly-attainable",
          focus: { talentId, position: focusPosition },
          nodes: [],
          objectiveByGroupId: new Map(),
          unquantifiedCandidates: [],
          inactiveAtPosition: [],
          connectEnablers: [],
        },
        suggestedUnlocks: [],
        search: {
          algorithm: "budgeted-connected-beam",
          beamWidth: BOARD_SUGGESTER_BEAM_WIDTH,
          statesExplored: 0,
          greedyBaselineMicroUnits: 0,
          selectedMicroUnits: 0,
        },
      },
      totalAvailable: total,
      alreadySpent,
      rankIncome,
    };
  }

  const directMode = board.pointMode === "direct";
  const planned = suggestHolomemBoardNodes({
    talentId,
    holomemRank: board.rank,
    extraPointsOwned: directMode ? total : board.extraPoints,
    playerLevel,
    unlockedNodeGroupIds: board.unlockedNodeGroupIds,
    focusPosition,
    team: request.team,
    ...(directMode ? { catalogs: zeroRankIncomeCatalogs(catalogs) } : {}),
  });
  return { planned, totalAvailable: total, alreadySpent, rankIncome };
}

function connectBoards(request: HolomemBoardRequest): HolomemBoardConnectBoard[] {
  return request.team.members.map((member) => {
    const board = request.boards[member.talentId]!;
    return {
      talentId: member.talentId,
      unlockedNodeGroupIds: board.unlockedNodeGroupIds,
      team: request.team,
      playerLevel: request.playerLevel,
    };
  });
}

export function planHolomemBoard(request: HolomemBoardRequest): HolomemBoardResult {
  const parsedRequest = HolomemBoardRequestSchema.parse(request);
  const perMember = parsedRequest.team.members.map((member) => {
    const position: BoardFocusPosition = member.talentId === parsedRequest.team.leader.talentId ? "leader" : "member";
    const { planned, totalAvailable: total, alreadySpent, rankIncome } = suggestForBoard(parsedRequest, member.talentId, position);
    const suggestions = planned.suggestedUnlocks.map((suggestion) => ({
      order: suggestion.order,
      nodeGroupId: suggestion.nodeGroupId,
      nodeId: suggestion.nodeId,
      kind: suggestion.kind,
      pointCost: suggestion.pointCost,
      valueMicroUnits: suggestion.valueMicroUnits,
      valueClass: suggestion.valueClass,
      appliesWhen: suggestion.appliesWhen,
      pathParentGroupId: suggestion.pathParentGroupId,
      effect: structuredEffect(suggestion, planned, mechanicsData.catalogs),
    }));
    return {
      talentId: member.talentId,
      cardId: member.cardId,
      position,
      ledger: {
        rankIncome,
        extraPoints: parsedRequest.boards[member.talentId]!.extraPoints,
        totalAvailable: total,
        alreadySpent,
        remainingAvailable: total - alreadySpent,
        suggestedCost: suggestions.reduce((sum, suggestion) => sum + suggestion.pointCost, 0),
      },
      claimedMicroUnits: planned.search.selectedMicroUnits,
      greedyBaselineMicroUnits: planned.search.greedyBaselineMicroUnits,
      suggestions,
    };
  });

  const connectRequest = {
    cards: parsedRequest.connectCandidates,
    boards: connectBoards(parsedRequest),
    team: parsedRequest.team,
    playerLevel: parsedRequest.playerLevel,
  };
  const connect = parsedRequest.amplificationModel === undefined
    ? recommendHolomemBoardConnect(connectRequest)
    : recommendHolomemBoardConnect({ ...connectRequest, amplificationModel: parsedRequest.amplificationModel });
  const rawResult = {
    schemaVersion: 1 as const,
    claim: {
      kind: "bounded-suggestion" as const,
      conditionalOn: "current-team-and-declared-board-state" as const,
      adjacencyBasis: "derived-orthogonal-grid-adjacency" as const,
      stackingModel: "additive-envelope-not-jointly-attainable" as const,
      unitConnectRule: "independent-user-confirmed" as const,
      globallyCertified: false as const,
    },
    perMember,
    connect: {
      assignment: connect.assignment,
      unitConnectRule: connect.unitConnectRule,
      amplificationModel: connect.amplificationModel,
      assignments: connect.assignments,
      lockedSlots: connect.lockedSlots,
      excludedCandidates: connect.excludedCandidates,
    },
    noteCodes: [],
  };
  const parsedResult = HolomemBoardResultSchema.parse(rawResult);
  return HolomemBoardContractSchema.parse({ request: parsedRequest, result: parsedResult }).result;
}
