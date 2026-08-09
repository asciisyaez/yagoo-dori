import { boardAdjacency, type BoardAdjacency } from "./holomem-board";
import {
  buildBoardNodeObjective,
  type BoardFocusPosition,
  type BoardNodeObjective,
  type HolomemBoardObjective,
  type HolomemBoardTeamContext,
} from "./holomem-board-suggester";
import { mechanicsData, type MechanicsData } from "./mechanics";

export const DEFAULT_TREE_MODEL_ID = "tree-model-001" as const;
export const DEFAULT_AMPLIFICATION_MODEL = "multiplier-total" as const;
export const CONNECT_ASSIGNMENT = "hungarian-complete" as const;
export const CONNECT_UNIT_RULE = "independent-user-confirmed" as const;
export const CONNECT_CLAIM_CONDITIONAL_ON = "current-team-and-declared-board-state" as const;
export const AMPLIFICATION_MODEL_ORDERING_NOTE =
  "Changing amplificationModel can reorder assignments because multiplier-total and multiplier-additional weight card effects differently." as const;

export type ConnectAmplificationModel = "multiplier-total" | "multiplier-additional";
export type HolomemBoardBloomStage = 0 | 1 | 2 | 3 | 4 | 5;
export type TreeModelIdByTalent = Readonly<Record<string, string>> | ReadonlyMap<string, string>;
export type BoardConnectCatalogs = MechanicsData["catalogs"];
export type BoardConnectCardMechanics = MechanicsData["cards"][number];

export type HolomemBoardConnectCard = Readonly<{
  cardId: string;
  bloomStage: number;
  rarity?: number;
  talentId?: string;
}>;

export type HolomemBoardConnectBoard = Readonly<{
  talentId: string;
  unlockedNodeGroupIds: readonly string[];
  objective?: HolomemBoardObjective;
  team?: HolomemBoardTeamContext;
  focusPosition?: BoardFocusPosition;
  adjacency?: BoardAdjacency;
  slotIds?: readonly string[];
  playerLevel?: number | null;
}>;

export type HolomemBoardConnectRequest = Readonly<{
  cards: readonly HolomemBoardConnectCard[];
  boards: readonly HolomemBoardConnectBoard[];
  team?: HolomemBoardTeamContext;
  playerLevel?: number | null;
  treeModelIdByTalent?: TreeModelIdByTalent;
  amplificationModel?: ConnectAmplificationModel;
  catalogs?: BoardConnectCatalogs;
  cardsCatalog?: readonly BoardConnectCardMechanics[];
  adjacency?: BoardAdjacency;
}>;

export type BoardConnectFootprintNode = Readonly<{
  nodeGroupId: string;
  nodeId: string;
  kind: BoardNodeObjective["kind"];
  valueClass: BoardNodeObjective["valueClass"];
  valueMicroUnits: number | null;
}>;

export type BoardConnectComposition = Readonly<{
  nodeCount: number;
  quantifiedNodeCount: number;
  quantifiedMicroUnits: number;
  byKind: readonly Readonly<{
    kind: BoardNodeObjective["kind"];
    nodeCount: number;
    quantifiedMicroUnits: number;
  }>[];
  nodes: readonly BoardConnectFootprintNode[];
}>;

export type BoardConnectPlacement = Readonly<{
  boardTalentId: string;
  slot: string;
  cardId: string;
  connectLevel: 1 | 2;
  extentId: string;
  amplificationPermil: number;
  gainMicroUnits: number;
  overlapsWith: readonly Readonly<{
    boardTalentId: string;
    slot: string;
    nodeGroupIds: readonly string[];
  }>[];
  footprint: Readonly<{
    nodeGroupIds: readonly string[];
    unlockedNodeGroupIds: readonly string[];
    composition: BoardConnectComposition;
  }>;
}>;

export type BoardConnectLockedSlot = Readonly<{
  boardTalentId: string;
  slot: string;
  reasonCodes: readonly ("player-level-gate" | "slot-not-unlocked")[];
  requiredPlayerLevel: number | null;
  playerLevel: number | null;
}>;

export type BoardConnectExcludedCandidate = Readonly<{
  cardId: string;
  reasonCodes: readonly string[];
}>;

export type HolomemBoardConnectResult = Readonly<{
  claim: Readonly<{
    conditionalOn: typeof CONNECT_CLAIM_CONDITIONAL_ON;
    globallyCertified: false;
  }>;
  assignment: typeof CONNECT_ASSIGNMENT;
  unitConnectRule: typeof CONNECT_UNIT_RULE;
  amplificationModel: ConnectAmplificationModel;
  amplificationModelNote: typeof AMPLIFICATION_MODEL_ORDERING_NOTE;
  assignments: readonly BoardConnectPlacement[];
  lockedSlots: readonly BoardConnectLockedSlot[];
  excludedCandidates: readonly BoardConnectExcludedCandidate[];
}>;

export type BoardConnectGainOptions = Readonly<{
  amplificationModel?: ConnectAmplificationModel;
  treeModelIdByTalent?: TreeModelIdByTalent;
  catalogs?: BoardConnectCatalogs;
  cardsCatalog?: readonly BoardConnectCardMechanics[];
  adjacency?: BoardAdjacency;
  team?: HolomemBoardTeamContext;
  playerLevel?: number | null;
}>;

export type BoardConnectGain = Readonly<{
  gainMicroUnits: number;
  connectLevel: 1 | 2;
  extentId: string;
  amplificationPermil: number;
  footprint: Readonly<{
    nodeGroupIds: readonly string[];
    unlockedNodeGroupIds: readonly string[];
    composition: BoardConnectComposition;
  }>;
}>;

type Context = Readonly<{
  catalogs: BoardConnectCatalogs;
  cardsCatalog: readonly BoardConnectCardMechanics[];
  adjacency: BoardAdjacency;
  treeModelIdByTalent: TreeModelIdByTalent | undefined;
  amplificationModel: ConnectAmplificationModel;
  team: HolomemBoardTeamContext | undefined;
  playerLevel: number | null | undefined;
}>;

type ResolvedCard = Readonly<{
  input: HolomemBoardConnectCard;
  mechanics: BoardConnectCardMechanics;
  connectLevel: 1 | 2;
  extentId: string;
  amplificationPermil: number;
}>;

type ValidCandidate = Readonly<{ input: HolomemBoardConnectCard; resolved: ResolvedCard }>;

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
}

function assertBloomStage(value: number): asserts value is HolomemBoardBloomStage {
  assertInteger(value, "Bloom stage");
  if (value < 0 || value > 5) throw new Error("Bloom stage must be an integer from 0 through 5");
}

function resolveModelId(talentId: string, mapping: TreeModelIdByTalent | undefined): string {
  if (!mapping) return DEFAULT_TREE_MODEL_ID;
  return mapping instanceof Map
    ? mapping.get(talentId) ?? DEFAULT_TREE_MODEL_ID
    : (mapping as Readonly<Record<string, string>>)[talentId] ?? DEFAULT_TREE_MODEL_ID;
}

function resolveAmplificationModel(model: ConnectAmplificationModel | undefined): ConnectAmplificationModel {
  const resolved = model ?? DEFAULT_AMPLIFICATION_MODEL;
  if (resolved !== "multiplier-total" && resolved !== "multiplier-additional") {
    throw new Error(`Unknown Connect amplification model: ${resolved}`);
  }
  return resolved;
}

function roundHalfUpSigned(numerator: bigint, denominator: bigint): bigint {
  const absolute = numerator < 0n ? -numerator : numerator;
  const rounded = (absolute + denominator / 2n) / denominator;
  return numerator < 0n ? -rounded : rounded;
}

function amplifiedMicroUnits(totalMicroUnits: number, valuePermil: number, model: ConnectAmplificationModel): number {
  const factorNumerator = model === "multiplier-total" ? valuePermil - 1_000 : valuePermil;
  const result = roundHalfUpSigned(BigInt(totalMicroUnits) * BigInt(factorNumerator), 1_000n);
  const asNumber = Number(result);
  if (!Number.isSafeInteger(asNumber)) throw new Error("Connect gain exceeded safe integer range");
  return asNumber;
}

function boardObjective(board: HolomemBoardConnectBoard, context: Context): HolomemBoardObjective {
  if (board.objective) return board.objective;
  const team = board.team ?? context.team;
  if (!team) throw new Error(`Board ${board.talentId} must declare an objective or team`);
  const focusPosition = board.focusPosition ?? (team.leader.talentId === board.talentId ? "leader" : "member");
  return buildBoardNodeObjective({
    team,
    focus: { talentId: board.talentId, position: focusPosition },
    unlockedNodeGroupIds: board.unlockedNodeGroupIds,
    playerLevel: board.playerLevel ?? context.playerLevel ?? 50,
    catalogs: context.catalogs,
    adjacency: board.adjacency ?? context.adjacency,
  });
}

function resolveCard(card: HolomemBoardConnectCard, context: Context): ResolvedCard {
  const mechanics = context.cardsCatalog.find((candidate) => candidate.cardId === card.cardId);
  if (!mechanics) throw new Error(`Connect card ${card.cardId} is missing from the mechanics catalog`);
  const rarity = card.rarity ?? mechanics.rarity;
  if (rarity !== 4 && rarity !== 5) throw new Error(`Connect card ${card.cardId} is not a placeable 4-star or 5-star card`);
  if (card.talentId !== undefined && card.talentId !== mechanics.talentId) {
    throw new Error(`Connect card ${card.cardId} does not belong to ${card.talentId}`);
  }
  assertBloomStage(card.bloomStage);
  const connectPotential = mechanics.progression.potential.find((effect) => effect.kind === "connect-effect-level-up");
  if (!connectPotential || connectPotential.stage !== 5) {
    throw new Error(`Connect card ${card.cardId} does not follow potential-progression-order`);
  }
  const connectLevel: 1 | 2 = card.bloomStage >= connectPotential.stage ? 2 : 1;
  const level = mechanics.progression.connectEffect.levels.find((candidate) => candidate.level === connectLevel);
  if (!level) throw new Error(`Connect card ${card.cardId} has no level ${connectLevel} effect`);
  return { input: card, mechanics, connectLevel, extentId: level.extentId, amplificationPermil: level.valuePermil };
}

function slotNode(slot: string, catalogs: BoardConnectCatalogs) {
  const node = catalogs.boardNodes.find((candidate) => candidate.groupId === slot && candidate.kind === "connection");
  if (!node) throw new Error(`Connect slot ${slot} is missing from the Board catalog`);
  return node;
}

function gateThreshold(slot: ReturnType<typeof slotNode>, catalogs: BoardConnectCatalogs): number | null {
  const conditionIds = [slot.viewConditionGroupId, slot.unlockConditionGroupId].filter((id): id is string => id !== null);
  if (conditionIds.length === 0) return null;
  return Math.max(...conditionIds.map((id) => {
    const condition = catalogs.boardNodeConditions.find((candidate) => candidate.id === id);
    if (!condition) throw new Error(`Board node condition ${id} is missing`);
    return condition.threshold;
  }));
}

function composition(nodes: readonly BoardNodeObjective[]): BoardConnectComposition {
  const sortedNodes = nodes.slice().sort((left, right) => left.nodeGroupId.localeCompare(right.nodeGroupId));
  const byKind = new Map<BoardNodeObjective["kind"], { nodeCount: number; quantifiedMicroUnits: number }>();
  let quantifiedNodeCount = 0;
  let quantifiedMicroUnits = 0;
  for (const node of sortedNodes) {
    const quantified = node.valueMicroUnits !== null && (node.valueClass === "flat" || node.valueClass === "permil");
    const current = byKind.get(node.kind) ?? { nodeCount: 0, quantifiedMicroUnits: 0 };
    current.nodeCount += 1;
    if (quantified) {
      quantifiedNodeCount += 1;
      quantifiedMicroUnits += node.valueMicroUnits!;
      current.quantifiedMicroUnits += node.valueMicroUnits!;
    }
    byKind.set(node.kind, current);
  }
  return {
    nodeCount: sortedNodes.length,
    quantifiedNodeCount,
    quantifiedMicroUnits,
    byKind: [...byKind.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, values]) => ({ kind, ...values })),
    nodes: sortedNodes.map((node) => ({
      nodeGroupId: node.nodeGroupId,
      nodeId: node.nodeId,
      kind: node.kind,
      valueClass: node.valueClass,
      valueMicroUnits: node.valueMicroUnits,
    })),
  };
}

function evaluateGain(
  card: HolomemBoardConnectCard,
  slot: string,
  board: HolomemBoardConnectBoard,
  context: Context,
  resolvedObjective?: HolomemBoardObjective,
  resolvedCard?: ResolvedCard,
): BoardConnectGain {
  const resolved = resolvedCard ?? resolveCard(card, context);
  const adjacency = board.adjacency ?? context.adjacency;
  const modelId = resolveModelId(board.talentId, context.treeModelIdByTalent);
  const cells = adjacency.cellByGroupIdByTreeModel.get(modelId);
  if (!cells) throw new Error(`Board tree model ${modelId} is missing for ${board.talentId}`);
  const host = cells.get(slot);
  if (!host) throw new Error(`Connect slot ${slot} has no position in ${modelId}`);
  const extent = context.catalogs.connectExtents.find((candidate) => candidate.id === resolved.extentId);
  if (!extent) throw new Error(`Connect extent ${resolved.extentId} is missing`);
  const groupIds = [...cells.entries()]
    .filter(([, cell]) => extent.positions.some((offset) => cell.x === host.x + offset.x && cell.y === host.y + offset.y))
    .map(([groupId]) => groupId)
    .sort();
  // The Board root (S-001) is free and ungated; the node suggester treats it
  // as implicitly unlocked, so the Connect footprint does the same.
  const unlocked = new Set([adjacency.startGroupId, ...board.unlockedNodeGroupIds]);
  const objective = resolvedObjective ?? boardObjective(board, context);
  const footprintNodes = groupIds
    .filter((groupId) => unlocked.has(groupId))
    .map((groupId) => objective.objectiveByGroupId.get(groupId))
    .filter((node): node is BoardNodeObjective => node !== undefined);
  const total = footprintNodes.reduce(
    (sum, node) => sum + (node.valueMicroUnits !== null && (node.valueClass === "flat" || node.valueClass === "permil") ? node.valueMicroUnits : 0),
    0,
  );
  return {
    gainMicroUnits: amplifiedMicroUnits(total, resolved.amplificationPermil, context.amplificationModel),
    connectLevel: resolved.connectLevel,
    extentId: resolved.extentId,
    amplificationPermil: resolved.amplificationPermil,
    footprint: {
      nodeGroupIds: groupIds,
      unlockedNodeGroupIds: footprintNodes.map((node) => node.nodeGroupId),
      composition: composition(footprintNodes),
    },
  };
}

export function gain(card: HolomemBoardConnectCard, slot: string, board: HolomemBoardConnectBoard, options: BoardConnectGainOptions = {}): number {
  const context: Context = {
    catalogs: options.catalogs ?? mechanicsData.catalogs,
    cardsCatalog: options.cardsCatalog ?? mechanicsData.cards,
    adjacency: options.adjacency ?? board.adjacency ?? boardAdjacency,
    treeModelIdByTalent: options.treeModelIdByTalent,
    amplificationModel: resolveAmplificationModel(options.amplificationModel),
    team: options.team,
    playerLevel: options.playerLevel,
  };
  return evaluateGain(card, slot, board, context).gainMicroUnits;
}

export const connectGain = gain;

function hungarianMax(weights: readonly (readonly number[])[]): number[] {
  const rowCount = weights.length;
  const columnCount = weights[0]?.length ?? 0;
  if (rowCount === 0) return [];
  if (columnCount < rowCount) throw new Error("Hungarian assignment requires at least as many columns as rows");
  const maxWeight = weights.flat().reduce((maximum, value) => Math.max(maximum, value), 0);
  const u = Array<bigint>(rowCount + 1).fill(0n);
  const v = Array<bigint>(columnCount + 1).fill(0n);
  const p = Array<number>(columnCount + 1).fill(0);
  const way = Array<number>(columnCount + 1).fill(0);
  for (let row = 1; row <= rowCount; row += 1) {
    p[0] = row;
    const minv = Array<bigint | null>(columnCount + 1).fill(null);
    const used = Array<boolean>(columnCount + 1).fill(false);
    let column = 0;
    do {
      used[column] = true;
      const currentRow = p[column]!;
      let delta: bigint | null = null;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) continue;
        const current = BigInt(maxWeight - weights[currentRow - 1]![candidate - 1]!) - u[currentRow]! - v[candidate]!;
        const previousMinimum = minv[candidate];
        if (previousMinimum === null || previousMinimum === undefined || current < previousMinimum) {
          minv[candidate] = current;
          way[candidate] = column;
        }
        const candidateMinimum = minv[candidate]!;
        if (delta === null || candidateMinimum < delta || (candidateMinimum === delta && candidate < nextColumn)) {
          delta = candidateMinimum;
          nextColumn = candidate;
        }
      }
      if (delta === null) throw new Error("Hungarian assignment could not find an augmenting path");
      for (let candidate = 0; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) {
          const rowIndex = p[candidate]!;
          u[rowIndex] = u[rowIndex]! + delta;
          v[candidate] = v[candidate]! - delta;
        } else if (minv[candidate] !== null && minv[candidate] !== undefined) {
          minv[candidate] = minv[candidate]! - delta;
        }
      }
      column = nextColumn;
    } while (p[column] !== 0);
    do {
      const previous = way[column]!;
      p[column] = p[previous]!;
      column = previous;
    } while (column !== 0);
  }
  const assignedColumnByRow = Array<number>(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (p[column] !== 0) assignedColumnByRow[p[column]! - 1] = column - 1;
  }
  return assignedColumnByRow;
}

function validCandidates(request: HolomemBoardConnectRequest, context: Context): {
  candidates: readonly ValidCandidate[];
  excluded: BoardConnectExcludedCandidate[];
} {
  const candidates: ValidCandidate[] = [];
  const excluded: BoardConnectExcludedCandidate[] = [];
  const seen = new Set<string>();
  for (const card of request.cards) {
    if (seen.has(card.cardId)) {
      excluded.push({ cardId: card.cardId, reasonCodes: ["duplicate-card-id"] });
      continue;
    }
    seen.add(card.cardId);
    if (card.rarity !== undefined && card.rarity !== 4 && card.rarity !== 5) {
      excluded.push({ cardId: card.cardId, reasonCodes: ["star-3-no-connect-effect"] });
      continue;
    }
    try {
      candidates.push({ input: card, resolved: resolveCard(card, context) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reasonCode = message.includes("Bloom stage")
        ? "invalid-bloom-stage"
        : message.includes("does not belong")
          ? "talent-mismatch"
          : message.includes("missing from")
            ? "unknown-card"
            : message.includes("not a placeable")
              ? "star-3-no-connect-effect"
              : "no-connect-effect";
      excluded.push({ cardId: card.cardId, reasonCodes: [reasonCode] });
    }
  }
  return { candidates, excluded };
}

function lockedSlot(board: HolomemBoardConnectBoard, slot: string, request: HolomemBoardConnectRequest, context: Context): BoardConnectLockedSlot | null {
  const node = slotNode(slot, context.catalogs);
  const playerLevel = board.playerLevel ?? request.playerLevel ?? null;
  const requiredPlayerLevel = gateThreshold(node, context.catalogs);
  const reasonCodes: ("player-level-gate" | "slot-not-unlocked")[] = [];
  if (requiredPlayerLevel !== null && playerLevel !== null && playerLevel < requiredPlayerLevel) reasonCodes.push("player-level-gate");
  // S-001 is the free, ungated Board root: implicitly unlocked, matching the
  // node suggester's treatment, so callers need not mark it redundantly.
  const startGroupId = (board.adjacency ?? context.adjacency).startGroupId;
  if (slot !== startGroupId && !board.unlockedNodeGroupIds.includes(slot)) reasonCodes.push("slot-not-unlocked");
  if (reasonCodes.length === 0) return null;
  return { boardTalentId: board.talentId, slot, reasonCodes, requiredPlayerLevel, playerLevel };
}

function buildContext(request: HolomemBoardConnectRequest): Context {
  return {
    catalogs: request.catalogs ?? mechanicsData.catalogs,
    cardsCatalog: request.cardsCatalog ?? mechanicsData.cards,
    adjacency: request.adjacency ?? boardAdjacency,
    treeModelIdByTalent: request.treeModelIdByTalent,
    amplificationModel: resolveAmplificationModel(request.amplificationModel),
    team: request.team,
    playerLevel: request.playerLevel,
  };
}

export function recommendHolomemBoardConnect(request: HolomemBoardConnectRequest): HolomemBoardConnectResult {
  const context = buildContext(request);
  const boardTalentIds = new Set<string>();
  for (const board of request.boards) {
    if (boardTalentIds.has(board.talentId)) throw new Error(`Connect request repeats Board ${board.talentId}`);
    boardTalentIds.add(board.talentId);
  }
  const { candidates: unorderedCandidates, excluded } = validCandidates(request, context);
  // Canonical ordering: equal-weight assignments must not depend on the
  // request's array order, so candidates sort by cardId and slots by
  // (board talent, slot) before the weight matrix is built.
  const candidates = [...unorderedCandidates].sort((left, right) =>
    left.input.cardId.localeCompare(right.input.cardId),
  );
  const eligibleSlots: { board: HolomemBoardConnectBoard; slot: string }[] = [];
  const lockedSlots: BoardConnectLockedSlot[] = [];
  for (const board of request.boards) {
    const slots = board.slotIds ?? context.catalogs.boardNodes.filter((node) => node.kind === "connection").map((node) => node.groupId).sort();
    for (const slot of slots) {
      const lock = lockedSlot(board, slot, request, context);
      if (lock) lockedSlots.push(lock);
      else eligibleSlots.push({ board, slot });
    }
  }
  eligibleSlots.sort(
    (left, right) =>
      left.board.talentId.localeCompare(right.board.talentId) || left.slot.localeCompare(right.slot),
  );
  // The objective depends only on the board, never on the (card, slot) pair —
  // memoize it per board (lazily, so boards with no eligible slots are never
  // built) instead of rebuilding one per pair.
  const objectiveByBoardTalentId = new Map<string, HolomemBoardObjective>();
  const objectiveFor = (board: HolomemBoardConnectBoard): HolomemBoardObjective => {
    const cached = objectiveByBoardTalentId.get(board.talentId);
    if (cached) return cached;
    const objective = boardObjective(board, context);
    objectiveByBoardTalentId.set(board.talentId, objective);
    return objective;
  };
  const evaluations = eligibleSlots.map(({ board, slot }) =>
    candidates.map(({ input, resolved }) =>
      evaluateGain(input, slot, board, context, objectiveFor(board), resolved),
    ),
  );
  const dummyCount = eligibleSlots.length;
  const weights = evaluations.map((row) => [...row.map((value) => value.gainMicroUnits), ...Array<number>(dummyCount).fill(0)]);
  const selectedColumns = hungarianMax(weights);
  const assignedCardIds = new Set<string>();
  const assignments: BoardConnectPlacement[] = [];
  for (let row = 0; row < eligibleSlots.length; row += 1) {
    const column = selectedColumns[row]!;
    if (column < candidates.length) {
      const candidate = candidates[column]!;
      const evaluation = evaluations[row]![column]!;
      if (evaluation.gainMicroUnits > 0) {
        assignedCardIds.add(candidate.input.cardId);
        const slot = eligibleSlots[row]!;
        assignments.push({
          boardTalentId: slot.board.talentId,
          slot: slot.slot,
          cardId: candidate.input.cardId,
          connectLevel: evaluation.connectLevel,
          extentId: evaluation.extentId,
          amplificationPermil: evaluation.amplificationPermil,
          gainMicroUnits: evaluation.gainMicroUnits,
          overlapsWith: [],
          footprint: evaluation.footprint,
        });
      }
    }
  }
  assignments.sort((left, right) => left.boardTalentId.localeCompare(right.boardTalentId) || left.slot.localeCompare(right.slot));
  const assignmentsWithOverlaps = assignments.map((placement) => ({
    ...placement,
    overlapsWith: assignments
      .filter((other) => other.boardTalentId === placement.boardTalentId && other.slot !== placement.slot)
      .map((other) => ({
        boardTalentId: other.boardTalentId,
        slot: other.slot,
        nodeGroupIds: placement.footprint.nodeGroupIds.filter((groupId) => other.footprint.nodeGroupIds.includes(groupId)),
      }))
      .filter((overlap) => overlap.nodeGroupIds.length > 0),
  }));
  for (const candidate of candidates) {
    if (assignedCardIds.has(candidate.input.cardId)) continue;
    const candidateIndex = candidates.indexOf(candidate);
    const hasPositiveGain = evaluations.some((row) => row[candidateIndex]!.gainMicroUnits > 0);
    excluded.push({ cardId: candidate.input.cardId, reasonCodes: [hasPositiveGain ? "assignment-not-selected" : "no-positive-gain"] });
  }
  excluded.sort((left, right) => left.cardId.localeCompare(right.cardId));
  lockedSlots.sort((left, right) => left.boardTalentId.localeCompare(right.boardTalentId) || left.slot.localeCompare(right.slot));
  return {
    claim: { conditionalOn: CONNECT_CLAIM_CONDITIONAL_ON, globallyCertified: false },
    assignment: CONNECT_ASSIGNMENT,
    unitConnectRule: CONNECT_UNIT_RULE,
    amplificationModel: context.amplificationModel,
    amplificationModelNote: AMPLIFICATION_MODEL_ORDERING_NOTE,
    assignments: assignmentsWithOverlaps,
    lockedSlots,
    excludedCandidates: excluded,
  };
}

export const suggestHolomemBoardConnect = recommendHolomemBoardConnect;
export const assignHolomemBoardConnect = recommendHolomemBoardConnect;
