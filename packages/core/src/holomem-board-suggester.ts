import {
  boardAdjacency,
  resolveBoardNodeForTalent,
  type BoardAdjacency,
  type BoardNode,
} from "./holomem-board";
import { mechanicsData, type MechanicsData, type ParameterSet } from "./mechanics";
import { publicCards, publicCardById } from "./public-data";

export const BOARD_SUGGESTER_BEAM_WIDTH = 64;
export const BOARD_SUGGESTER_STACKING_MODEL = "additive-envelope-not-jointly-attainable" as const;
export const BOARD_SUGGESTER_CLAIM = "bounded-search" as const;
export const BOARD_SUGGESTER_MICRO_UNITS_PER_POINT = 1_000_000;

export const QUANTIFIED_BOARD_EFFECT_KINDS = Object.freeze({
  "performance-up": "performance-flat",
  "technique-up": "technique-flat",
  "sense-up": "sense-flat",
  "all-parameter-up": "all-parameters-flat",
  "performance-up-permil-up": "performance-permil",
  "technique-up-permil-up": "technique-permil",
  "sense-up-permil-up": "sense-permil",
  "all-parameter-up-permil-up": "all-parameters-permil",
} as const);

export const KNOWN_UNQUANTIFIED_BOARD_EFFECT_KINDS = Object.freeze([
  "all-parameter-up-for-character-grouping",
  "life-up",
  "live-active-skill-activation-probability-up-permil-up",
  "live-active-skill-cool-time-shorten-permil-up",
  "live-active-skill-effect-up-permil-up",
  "live-deck-leader-active-skill-addition",
  "live-deck-leader-active-skill-level-up",
  "live-reward-card-exp-quantity-up-permil-up",
  "live-reward-quantity-up-permil-up",
  "live-score-bonus-add-permil-up-by-music-skill-tree-character-and-music-singer-type",
  "mini-game-reward-quantity-up-permil-up",
  "work-reward-quantity-up-permil-up",
] as const);

type BoardEffectKind = MechanicsData["catalogs"]["boardEffects"][number]["kind"];
type BoardEffect = MechanicsData["catalogs"]["boardEffects"][number];
type MechanicsCatalogs = MechanicsData["catalogs"];

export type BoardFocusPosition = "leader" | "member";
export type BoardParameterLens = "one-copy-max" | "max-potential";
export type BoardValueClass = "flat" | "permil" | "unquantified" | "connector" | "inactive" | "out-of-scope";

export type HolomemBoardTeamMember = Readonly<{
  talentId: string;
  cardId: string;
  lens: BoardParameterLens;
}>;

export type HolomemBoardTeamContext = Readonly<{
  leader: HolomemBoardTeamMember;
  members: readonly HolomemBoardTeamMember[];
}>;

export type HolomemBoardObjectiveInput = Readonly<{
  team: HolomemBoardTeamContext;
  focus: Readonly<{ talentId: string; position: BoardFocusPosition }>;
  unlockedNodeGroupIds?: readonly string[];
  playerLevel?: number;
  catalogs?: MechanicsCatalogs;
  adjacency?: BoardAdjacency;
}>;

export type HolomemBoardSuggestionInput = Readonly<{
  talentId: string;
  holomemRank: number;
  extraPointsOwned: number;
  playerLevel: number;
  unlockedNodeGroupIds: readonly string[];
  focusPosition: BoardFocusPosition;
  team: HolomemBoardTeamContext;
  catalogs?: MechanicsCatalogs;
  adjacency?: BoardAdjacency;
}>;

export type BoardNodeObjective = Readonly<{
  nodeGroupId: string;
  nodeId: string;
  kind: BoardNode["kind"];
  pointCost: number;
  effectId: string | null;
  effectKind: string | null;
  valueMicroUnits: number | null;
  valueClass: BoardValueClass;
  appliesWhen: "always" | "while-leading" | null;
}>;

export type BoardUnquantifiedCandidate = Readonly<{
  nodeGroupId: string;
  nodeId: string;
  kind: BoardNode["kind"];
  pointCost: number;
  effectId: string;
  effectKind: string;
  appliesWhen: "always" | "while-leading";
}>;

export type BoardInactiveCandidate = Readonly<{
  nodeGroupId: string;
  nodeId: string;
  kind: "leader";
  pointCost: number;
  effectId: string;
  effectKind: string;
  valueMicroUnits: null;
  appliesWhen: "while-leading";
}>;

export type BoardConnectEnabler = Readonly<{
  nodeGroupId: string;
  nodeId: string;
  pointCost: number;
  pathGroupIds: readonly string[];
  pathCost: number;
  playerLevelGate: number | null;
  availableAtPlayerLevel: boolean;
}>;

export type HolomemBoardObjective = Readonly<{
  stackingModel: typeof BOARD_SUGGESTER_STACKING_MODEL;
  focus: Readonly<{ talentId: string; position: BoardFocusPosition }>;
  nodes: readonly BoardNodeObjective[];
  objectiveByGroupId: ReadonlyMap<string, BoardNodeObjective>;
  unquantifiedCandidates: readonly BoardUnquantifiedCandidate[];
  inactiveAtPosition: readonly BoardInactiveCandidate[];
  connectEnablers: readonly BoardConnectEnabler[];
}>;

export type BoardSuggestedUnlock = Readonly<{
  order: number;
  nodeGroupId: string;
  nodeId: string;
  kind: BoardNode["kind"];
  pointCost: number;
  valueMicroUnits: number | null;
  valueClass: BoardValueClass;
  appliesWhen: "always" | "while-leading" | null;
  pathParentGroupId: string;
}>;

export type HolomemBoardSuggestion = Readonly<{
  claim: typeof BOARD_SUGGESTER_CLAIM;
  stackingModel: typeof BOARD_SUGGESTER_STACKING_MODEL;
  budget: Readonly<{
    holomemRank: number;
    rankPointIncome: number;
    extraPointsOwned: number;
    totalBudget: number;
    alreadySpent: number;
    available: number;
  }>;
  boardDiagnostics: Readonly<{
    declaredStateConsistentWithDerivedAdjacency: boolean;
  }>;
  objective: HolomemBoardObjective;
  suggestedUnlocks: readonly BoardSuggestedUnlock[];
  search: Readonly<{
    algorithm: "budgeted-connected-beam";
    beamWidth: typeof BOARD_SUGGESTER_BEAM_WIDTH;
    statesExplored: number;
    greedyBaselineMicroUnits: number;
    selectedMicroUnits: number;
  }>;
}>;

const QUANTIFIED_KINDS = new Set<string>(Object.keys(QUANTIFIED_BOARD_EFFECT_KINDS));
const KNOWN_UNQUANTIFIED_KINDS = new Set<string>(KNOWN_UNQUANTIFIED_BOARD_EFFECT_KINDS);
const ALL_PARAMETER_KINDS = new Set(["all-parameter-up", "all-parameter-up-permil-up"]);
const PARAMETER_BY_KIND = new Map<string, keyof ParameterSet>([
  ["performance-up", "performance"],
  ["technique-up", "technique"],
  ["sense-up", "sense"],
  ["performance-up-permil-up", "performance"],
  ["technique-up-permil-up", "technique"],
  ["sense-up-permil-up", "sense"],
]);

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
}

function assertNonnegativeInteger(value: number, label: string): void {
  assertInteger(value, label);
  if (value < 0) throw new Error(`${label} must be nonnegative`);
}

function assertBoardEffectKindPartition(catalogs: MechanicsCatalogs): void {
  const overlap = [...QUANTIFIED_KINDS].filter((kind) => KNOWN_UNQUANTIFIED_KINDS.has(kind));
  if (overlap.length > 0) throw new Error(`Board effect-kind partition overlaps: ${overlap.join(", ")}`);

  const effectById = new Map(catalogs.boardEffects.map((effect) => [effect.id, effect]));
  for (const node of catalogs.boardNodes) {
    if (node.kind !== "leader" && node.kind !== "card") continue;
    if (node.effectId === null) throw new Error(`In-scope Board node ${node.groupId} has no effect`);
    const effect = effectById.get(node.effectId);
    if (!effect) throw new Error(`In-scope Board node ${node.groupId} references missing effect ${node.effectId}`);
    if (!QUANTIFIED_KINDS.has(effect.kind) && !KNOWN_UNQUANTIFIED_KINDS.has(effect.kind)) {
      throw new Error(`Unclassified in-scope Board effect kind: ${effect.kind}`);
    }
  }
}

function roundHalfUpPermil(value: number, base: number): number {
  assertNonnegativeInteger(value, "Board permil value");
  assertNonnegativeInteger(base, "Board parameter base");
  const numerator = BigInt(value) * BigInt(base) * BigInt(BOARD_SUGGESTER_MICRO_UNITS_PER_POINT);
  const rounded = (numerator + 500n) / 1_000n;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("Board objective exceeded safe integer range");
  return result;
}

function parameterMicroUnits(value: number): number {
  assertNonnegativeInteger(value, "Board flat value");
  const result = value * BOARD_SUGGESTER_MICRO_UNITS_PER_POINT;
  if (!Number.isSafeInteger(result)) throw new Error("Board objective exceeded safe integer range");
  return result;
}

function allParameterMicroUnits(value: number, recipientCount: number): number {
  assertNonnegativeInteger(value, "Board flat value");
  assertNonnegativeInteger(recipientCount, "Board recipient count");
  const result = value * 3 * recipientCount * BOARD_SUGGESTER_MICRO_UNITS_PER_POINT;
  if (!Number.isSafeInteger(result)) throw new Error("Board objective exceeded safe integer range");
  return result;
}

function allParameterPermilMicroUnits(value: number, recipients: readonly ParameterSet[]): number {
  return recipients.reduce(
    (total, stats) => total + roundHalfUpPermil(value, stats.performance + stats.technique + stats.sense),
    0,
  );
}

function parameterPermilMicroUnits(value: number, parameter: keyof ParameterSet, stats: ParameterSet): number {
  return roundHalfUpPermil(value, stats[parameter]);
}

function validateTeam(team: HolomemBoardTeamContext): void {
  if (team.members.length !== 5) throw new Error("Board objective requires exactly five team members");
  const talentIds = new Set(team.members.map((member) => member.talentId));
  if (talentIds.size !== team.members.length) throw new Error("Board objective team members must have unique talents");
  if (!talentIds.has(team.leader.talentId)) throw new Error("Board leader must be one of the team members");
}

function pinnedStats(member: HolomemBoardTeamMember): ParameterSet {
  // No fallback: a guessed card silently reprices every objective value for the
  // member, so an absent identity is rejected rather than substituted.
  if (typeof member.cardId !== "string" || member.cardId.length === 0) {
    throw new Error(`Board team member ${member.talentId} must declare its cardId`);
  }
  if (member.lens !== "one-copy-max" && member.lens !== "max-potential") {
    throw new Error(`Board team member ${member.talentId} must declare a parameter lens`);
  }
  const card = publicCardById.get(member.cardId);
  if (!card) throw new Error(`Pinned public card is missing for talent ${member.talentId}`);
  if (card.talentId !== member.talentId) throw new Error(`Pinned card ${card.id} does not belong to ${member.talentId}`);
  return card.parameters[member.lens === "one-copy-max" ? "oneCopyMaxLevel" : "maxPotential"];
}

function teamStats(team: HolomemBoardTeamContext): Map<string, ParameterSet> {
  validateTeam(team);
  return new Map(team.members.map((member) => [member.talentId, pinnedStats(member)]));
}

function conditionThreshold(node: BoardNode, catalogs: MechanicsCatalogs): number | null {
  const ids = [node.viewConditionGroupId, node.unlockConditionGroupId].filter((id): id is string => id !== null);
  if (ids.length === 0) return null;
  const thresholds = ids.map((id) => {
    const condition = catalogs.boardNodeConditions.find((candidate) => candidate.id === id);
    if (!condition) throw new Error(`Board node condition ${id} is missing`);
    return condition.threshold;
  });
  return Math.max(...thresholds);
}

function isVisible(node: BoardNode, playerLevel: number, catalogs: MechanicsCatalogs): boolean {
  const threshold = conditionThreshold(node, catalogs);
  return threshold === null || playerLevel >= threshold;
}

function sortedGroupIds(ids: Iterable<string>): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function canonicalGroupKey(ids: Iterable<string>): string {
  return sortedGroupIds(ids).join("|");
}

function compareIntegerRatio(
  leftValue: number,
  leftCost: number,
  rightValue: number,
  rightCost: number,
): number {
  if (leftCost === 0 || rightCost === 0) {
    if (leftCost === 0 && rightCost === 0) return leftValue === rightValue ? 0 : leftValue > rightValue ? -1 : 1;
    if (leftCost === 0) return leftValue > 0 ? -1 : 1;
    return rightValue > 0 ? 1 : -1;
  }
  const left = BigInt(leftValue) * BigInt(rightCost);
  const right = BigInt(rightValue) * BigInt(leftCost);
  return left === right ? 0 : left > right ? -1 : 1;
}

function compareMoves(left: SearchMove, right: SearchMove): number {
  const ratio = compareIntegerRatio(left.valueMicroUnits, left.cost, right.valueMicroUnits, right.cost);
  if (ratio !== 0) return ratio;
  if (left.valueMicroUnits !== right.valueMicroUnits) return left.valueMicroUnits > right.valueMicroUnits ? -1 : 1;
  if (left.cost !== right.cost) return left.cost - right.cost;
  return left.groupKey.localeCompare(right.groupKey);
}

function compareStateValue(left: SearchState, right: SearchState): number {
  if (left.valueMicroUnits !== right.valueMicroUnits) return left.valueMicroUnits > right.valueMicroUnits ? -1 : 1;
  if (left.spent !== right.spent) return left.spent - right.spent;
  return compareUnlockedMembership(left.words, right.words);
}

function compareStateRank(left: SearchState, right: SearchState): number {
  const ratio = compareIntegerRatio(left.valueMicroUnits, left.spent, right.valueMicroUnits, right.spent);
  if (ratio !== 0) return ratio;
  return compareStateValue(left, right);
}

type PathResult = Readonly<{ groupIds: readonly string[]; cost: number }>;

/**
 * Multi-source Dijkstra over the 152-group grid, rooted at the unlocked set.
 * Deterministic without sorting in the hot loop: settlement picks the lowest
 * tentative cost with lexicographic group-id tie-break, and an equal-cost
 * relaxation keeps the lexicographically smaller parent. Paths are stored as
 * parent pointers and reconstructed once at the end, so no arrays are copied
 * per relaxation. When `targets` is given the search stops as soon as every
 * reachable target is settled.
 */
function cheapestPathsFromUnlocked(
  unlocked: ReadonlySet<string>,
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  adjacency: BoardAdjacency,
  catalogs: MechanicsCatalogs,
  playerLevel: number,
  respectVisibility = true,
  targets?: ReadonlySet<string>,
): Map<string, PathResult> {
  const tentativeCost = new Map<string, number>();
  const parentByGroupId = new Map<string, string>();
  const frontier = new Set<string>();
  const settled = new Set<string>();
  for (const groupId of unlocked) {
    if (nodeByGroupId.has(groupId)) {
      tentativeCost.set(groupId, 0);
      frontier.add(groupId);
    }
  }
  let unsettledTargets = targets
    ? [...targets].filter((groupId) => !unlocked.has(groupId)).length
    : -1;
  while (frontier.size > 0 && unsettledTargets !== 0) {
    let current: string | null = null;
    let currentCost = Number.POSITIVE_INFINITY;
    for (const groupId of frontier) {
      const candidateCost = tentativeCost.get(groupId)!;
      if (
        candidateCost < currentCost ||
        (candidateCost === currentCost && (current === null || groupId.localeCompare(current) < 0))
      ) {
        current = groupId;
        currentCost = candidateCost;
      }
    }
    frontier.delete(current!);
    settled.add(current!);
    if (targets?.has(current!) && !unlocked.has(current!)) unsettledTargets -= 1;
    for (const neighbor of adjacency.neighborsByGroupId.get(current!) ?? []) {
      if (unlocked.has(neighbor) || settled.has(neighbor)) continue;
      const neighborNode = nodeByGroupId.get(neighbor);
      if (!neighborNode || (respectVisibility && !isVisible(neighborNode, playerLevel, catalogs))) continue;
      const candidateCost = currentCost + neighborNode.pointCost;
      const previousCost = tentativeCost.get(neighbor);
      if (
        previousCost === undefined ||
        candidateCost < previousCost ||
        (candidateCost === previousCost &&
          current!.localeCompare(parentByGroupId.get(neighbor)!) < 0)
      ) {
        tentativeCost.set(neighbor, candidateCost);
        parentByGroupId.set(neighbor, current!);
        frontier.add(neighbor);
      }
    }
  }
  const paths = new Map<string, PathResult>();
  for (const groupId of settled) {
    if (unlocked.has(groupId)) {
      paths.set(groupId, { groupIds: [], cost: 0 });
      continue;
    }
    const chain: string[] = [];
    let cursor: string | undefined = groupId;
    while (cursor !== undefined && !unlocked.has(cursor)) {
      chain.push(cursor);
      cursor = parentByGroupId.get(cursor);
    }
    chain.reverse();
    paths.set(groupId, { groupIds: chain, cost: tentativeCost.get(groupId)! });
  }
  return paths;
}

function cheapestPathToTarget(
  targetGroupId: string,
  unlocked: ReadonlySet<string>,
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  adjacency: BoardAdjacency,
  catalogs: MechanicsCatalogs,
  playerLevel: number,
  respectVisibility = true,
): PathResult | null {
  return cheapestPathsFromUnlocked(
    unlocked,
    nodeByGroupId,
    adjacency,
    catalogs,
    playerLevel,
    respectVisibility,
    new Set([targetGroupId]),
  ).get(targetGroupId) ?? null;
}

function parentForGroup(
  groupId: string,
  unlocked: ReadonlySet<string>,
  adjacency: BoardAdjacency,
): string {
  const parent = (adjacency.neighborsByGroupId.get(groupId) ?? []).find((neighbor) => unlocked.has(neighbor));
  if (!parent) throw new Error(`Board suggestion group ${groupId} has no unlocked adjacent parent`);
  return parent === adjacency.startGroupId ? "start" : parent;
}

function nodeValue(node: BoardNodeObjective): number {
  return node.valueMicroUnits ?? 0;
}

function objectiveForEffect(
  node: BoardNode,
  effect: BoardEffect,
  input: HolomemBoardObjectiveInput,
  statsByTalent: ReadonlyMap<string, ParameterSet>,
): BoardNodeObjective {
  const isLeaderEffect = node.kind === "leader";
  const isCardEffect = node.kind === "card";
  const appliesWhen = isLeaderEffect ? "while-leading" : isCardEffect ? "always" : null;
  if (!isLeaderEffect && !isCardEffect) {
    return {
      nodeGroupId: node.groupId,
      nodeId: node.id,
      kind: node.kind,
      pointCost: node.pointCost,
      effectId: node.effectId,
      effectKind: effect.kind,
      valueMicroUnits: 0,
      valueClass: "out-of-scope",
      appliesWhen: null,
    };
  }

  if (isLeaderEffect && input.focus.position !== "leader") {
    return {
      nodeGroupId: node.groupId,
      nodeId: node.id,
      kind: node.kind,
      pointCost: node.pointCost,
      effectId: node.effectId,
      effectKind: effect.kind,
      valueMicroUnits: null,
      valueClass: "inactive",
      appliesWhen,
    };
  }

  if (KNOWN_UNQUANTIFIED_KINDS.has(effect.kind)) {
    return {
      nodeGroupId: node.groupId,
      nodeId: node.id,
      kind: node.kind,
      pointCost: node.pointCost,
      effectId: node.effectId,
      effectKind: effect.kind,
      valueMicroUnits: null,
      valueClass: "unquantified",
      appliesWhen,
    };
  }

  if (!QUANTIFIED_KINDS.has(effect.kind)) {
    throw new Error(`Unclassified in-scope Board effect kind: ${effect.kind}`);
  }
  if (effect.value === null) throw new Error(`Quantified Board effect ${effect.id} has no value`);

  const recipients = isLeaderEffect
    ? [...statsByTalent.values()]
    : [statsByTalent.get(input.focus.talentId)!];
  if (recipients.some((stats) => stats === undefined)) {
    throw new Error(`Pinned stats are missing for Board focus talent ${input.focus.talentId}`);
  }

  const isPermil = effect.kind.endsWith("-permil-up");
  const valueMicroUnits = ALL_PARAMETER_KINDS.has(effect.kind)
    ? isPermil
      ? allParameterPermilMicroUnits(effect.value, recipients)
      : allParameterMicroUnits(effect.value, recipients.length)
    : isPermil
      ? recipients.reduce(
        (total, stats) => total + parameterPermilMicroUnits(effect.value!, PARAMETER_BY_KIND.get(effect.kind)!, stats),
        0,
      )
      : recipients.reduce(
        (total) => total + parameterMicroUnits(effect.value!),
        0,
      );

  return {
    nodeGroupId: node.groupId,
    nodeId: node.id,
    kind: node.kind,
    pointCost: node.pointCost,
    effectId: node.effectId,
    effectKind: effect.kind,
    valueMicroUnits,
    valueClass: isPermil ? "permil" : "flat",
    appliesWhen,
  };
}

function resolveNodeForFocus(groupId: string, talentId: string, catalogs: MechanicsCatalogs): BoardNode {
  return resolveBoardNodeForTalent(groupId, talentId, catalogs);
}

function objectiveContext(input: HolomemBoardObjectiveInput): {
  catalogs: MechanicsCatalogs;
  adjacency: BoardAdjacency;
  statsByTalent: Map<string, ParameterSet>;
  unlocked: Set<string>;
  playerLevel: number;
} {
  const catalogs = input.catalogs ?? mechanicsData.catalogs;
  const adjacency = input.adjacency ?? boardAdjacency;
  const statsByTalent = teamStats(input.team);
  if (!statsByTalent.has(input.focus.talentId)) throw new Error(`Board focus talent ${input.focus.talentId} is not in the team`);
  if (input.focus.position === "leader" && input.team.leader.talentId !== input.focus.talentId) {
    throw new Error("Leader-position Board focus must match the declared team leader");
  }
  const unlocked = new Set(input.unlockedNodeGroupIds ?? []);
  unlocked.add(adjacency.startGroupId);
  const playerLevel = input.playerLevel ?? 0;
  assertNonnegativeInteger(playerLevel, "Board player level");
  assertBoardEffectKindPartition(catalogs);
  return { catalogs, adjacency, statsByTalent, unlocked, playerLevel };
}

export function computeBoardNodeObjective(
  groupId: string,
  input: HolomemBoardObjectiveInput,
): BoardNodeObjective {
  const context = objectiveContext(input);
  const node = resolveNodeForFocus(groupId, input.focus.talentId, context.catalogs);
  if (node.kind === "connection") {
    return {
      nodeGroupId: node.groupId,
      nodeId: node.id,
      kind: node.kind,
      pointCost: node.pointCost,
      effectId: node.effectId,
      effectKind: null,
      valueMicroUnits: 0,
      valueClass: "connector",
      appliesWhen: null,
    };
  }
  if (node.effectId === null) throw new Error(`Board node ${node.groupId} has no effect`);
  const effect = context.catalogs.boardEffects.find((candidate) => candidate.id === node.effectId);
  if (!effect) throw new Error(`Board effect ${node.effectId} is missing`);
  return objectiveForEffect(node, effect, input, context.statsByTalent);
}

export function buildBoardNodeObjective(input: HolomemBoardObjectiveInput): HolomemBoardObjective {
  const context = objectiveContext(input);
  const groupIds = sortedGroupIds(context.adjacency.neighborsByGroupId.keys());
  const effectById = new Map(context.catalogs.boardEffects.map((effect) => [effect.id, effect]));
  const nodeByGroupIdForFocus = new Map(
    groupIds.map((id) => [id, resolveNodeForFocus(id, input.focus.talentId, context.catalogs)]),
  );
  const nodes: BoardNodeObjective[] = [];
  const unquantifiedCandidates: BoardUnquantifiedCandidate[] = [];
  const inactiveAtPosition: BoardInactiveCandidate[] = [];
  const connectEnablers: BoardConnectEnabler[] = [];

  for (const groupId of groupIds) {
    const node = resolveNodeForFocus(groupId, input.focus.talentId, context.catalogs);
    const objective = node.kind === "connection"
      ? {
        nodeGroupId: node.groupId,
        nodeId: node.id,
        kind: node.kind,
        pointCost: node.pointCost,
        effectId: node.effectId,
        effectKind: null,
        valueMicroUnits: 0,
        valueClass: "connector" as const,
        appliesWhen: null,
      }
      : node.effectId === null
        ? (() => { throw new Error(`Board node ${node.groupId} has no effect`); })()
        : (() => {
          const effect = effectById.get(node.effectId);
          if (!effect) throw new Error(`Board effect ${node.effectId} is missing`);
          return objectiveForEffect(node, effect, input, context.statsByTalent);
        })();
    nodes.push(objective);

    if (objective.valueClass === "unquantified") {
      unquantifiedCandidates.push({
        nodeGroupId: objective.nodeGroupId,
        nodeId: objective.nodeId,
        kind: objective.kind,
        pointCost: objective.pointCost,
        effectId: objective.effectId!,
        effectKind: objective.effectKind!,
        appliesWhen: objective.appliesWhen!,
      });
    }
    if (objective.valueClass === "inactive") {
      if (KNOWN_UNQUANTIFIED_KINDS.has(objective.effectKind!)) {
        unquantifiedCandidates.push({
          nodeGroupId: objective.nodeGroupId,
          nodeId: objective.nodeId,
          kind: objective.kind,
          pointCost: objective.pointCost,
          effectId: objective.effectId!,
          effectKind: objective.effectKind!,
          appliesWhen: "while-leading",
        });
      }
      inactiveAtPosition.push({
        nodeGroupId: objective.nodeGroupId,
        nodeId: objective.nodeId,
        kind: "leader",
        pointCost: objective.pointCost,
        effectId: objective.effectId!,
        effectKind: objective.effectKind!,
        valueMicroUnits: null,
        appliesWhen: "while-leading",
      });
    }
    if (node.kind === "connection") {
      const availablePath = cheapestPathToTarget(
        node.groupId,
        context.unlocked,
        nodeByGroupIdForFocus,
        context.adjacency,
        context.catalogs,
        context.playerLevel,
      );
      const cheapestPath = cheapestPathToTarget(
        node.groupId,
        context.unlocked,
        nodeByGroupIdForFocus,
        context.adjacency,
        context.catalogs,
        context.playerLevel,
        false,
      );
      connectEnablers.push({
        nodeGroupId: node.groupId,
        nodeId: node.id,
        pointCost: node.pointCost,
        pathGroupIds: cheapestPath?.groupIds ?? [],
        pathCost: cheapestPath?.cost ?? 0,
        playerLevelGate: conditionThreshold(node, context.catalogs),
        availableAtPlayerLevel: availablePath !== null,
      });
    }
  }

  return {
    stackingModel: BOARD_SUGGESTER_STACKING_MODEL,
    focus: input.focus,
    nodes,
    objectiveByGroupId: new Map(nodes.map((node) => [node.nodeGroupId, node])),
    unquantifiedCandidates,
    inactiveAtPosition,
    connectEnablers,
  };
}

type SearchMove = Readonly<{
  groupIds: readonly string[];
  cost: number;
  valueMicroUnits: number;
  groupKey: string;
}>;

type SearchState = Readonly<{
  unlocked: ReadonlySet<string>;
  spent: number;
  valueMicroUnits: number;
  addedInOrder: readonly string[];
  /** 32-bit bitset words over the group-index space; `key` is their join. */
  words: readonly number[];
  key: string;
}>;

function buildGroupIndex(adjacency: BoardAdjacency): ReadonlyMap<string, number> {
  return new Map(sortedGroupIds(adjacency.neighborsByGroupId.keys()).map((groupId, index) => [groupId, index]));
}

function wordsForGroups(ids: Iterable<string>, groupIndexById: ReadonlyMap<string, number>): number[] {
  const words = new Array<number>(Math.max(1, Math.ceil(groupIndexById.size / 32))).fill(0);
  for (const id of ids) {
    const index = groupIndexById.get(id);
    if (index === undefined) throw new Error(`Board search group ${id} is not indexed`);
    words[index >>> 5] = (words[index >>> 5]! | (1 << (index & 31))) | 0;
  }
  return words;
}

/**
 * Compares two unlocked bitsets as their ascending group-index sequences —
 * because the group index is built over sorted group ids, this reproduces the
 * design-mandated sorted-groupId lexicographic tie order exactly. The set
 * owning the smallest differing index sorts first unless the other set is a
 * strict prefix, in which case the shorter sequence sorts first.
 */
export function compareUnlockedMembership(left: readonly number[], right: readonly number[]): number {
  const wordCount = Math.max(left.length, right.length);
  for (let wordIndex = 0; wordIndex < wordCount; wordIndex += 1) {
    const leftWord = left[wordIndex] ?? 0;
    const rightWord = right[wordIndex] ?? 0;
    if (leftWord === rightWord) continue;
    const differing = (leftWord ^ rightWord) | 0;
    const lowestBit = differing & -differing;
    const bit = 31 - Math.clz32(lowestBit >>> 0);
    const inLeft = (leftWord & lowestBit) !== 0;
    const other = inLeft ? right : left;
    const aboveMask = bit === 31 ? 0 : (-1 << (bit + 1)) | 0;
    let otherHasLaterIndex = ((other[wordIndex] ?? 0) & aboveMask) !== 0;
    for (let later = wordIndex + 1; later < wordCount && !otherHasLaterIndex; later += 1) {
      if ((other[later] ?? 0) !== 0) otherHasLaterIndex = true;
    }
    if (inLeft) return otherHasLaterIndex ? -1 : 1;
    return otherHasLaterIndex ? 1 : -1;
  }
  return 0;
}

/** Returns null when an addition is already present (a repeated group). */
function wordsWith(
  base: readonly number[],
  additions: readonly string[],
  groupIndexById: ReadonlyMap<string, number>,
): number[] | null {
  const words = [...base];
  for (const id of additions) {
    const index = groupIndexById.get(id);
    if (index === undefined) throw new Error(`Board search group ${id} is not indexed`);
    const word = index >>> 5;
    const bit = 1 << (index & 31);
    if ((words[word]! & bit) !== 0) return null;
    words[word] = (words[word]! | bit) | 0;
  }
  return words;
}

function frontierMoves(
  state: SearchState,
  remaining: number,
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  objectiveByGroupId: ReadonlyMap<string, BoardNodeObjective>,
  adjacency: BoardAdjacency,
  catalogs: MechanicsCatalogs,
  playerLevel: number,
): SearchMove[] {
  const moves: SearchMove[] = [];
  for (const groupId of sortedGroupIds(nodeByGroupId.keys())) {
    if (state.unlocked.has(groupId)) continue;
    const node = nodeByGroupId.get(groupId)!;
    if (!isVisible(node, playerLevel, catalogs) || node.pointCost > remaining) continue;
    if (!(adjacency.neighborsByGroupId.get(groupId) ?? []).some((neighbor) => state.unlocked.has(neighbor))) continue;
    const objective = objectiveByGroupId.get(groupId)!;
    moves.push({
      groupIds: [groupId],
      cost: node.pointCost,
      valueMicroUnits: nodeValue(objective),
      groupKey: groupId,
    });
  }
  return moves;
}

function bundleMoves(
  state: SearchState,
  remaining: number,
  positiveGroupIds: readonly string[],
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  objectiveByGroupId: ReadonlyMap<string, BoardNodeObjective>,
  adjacency: BoardAdjacency,
  catalogs: MechanicsCatalogs,
  playerLevel: number,
): SearchMove[] {
  const moves: SearchMove[] = [];
  const paths = cheapestPathsFromUnlocked(
    state.unlocked,
    nodeByGroupId,
    adjacency,
    catalogs,
    playerLevel,
    true,
    new Set(positiveGroupIds),
  );
  for (const targetGroupId of positiveGroupIds) {
    if (state.unlocked.has(targetGroupId)) continue;
    const path = paths.get(targetGroupId) ?? null;
    if (!path || path.groupIds.length === 0 || path.cost > remaining) continue;
    moves.push({
      groupIds: path.groupIds,
      cost: path.cost,
      valueMicroUnits: path.groupIds.reduce((total, groupId) => total + nodeValue(objectiveByGroupId.get(groupId)!), 0),
      groupKey: path.groupIds.join("|"),
    });
  }
  return moves;
}

function dedupeMoves(moves: readonly SearchMove[]): SearchMove[] {
  const byKey = new Map<string, SearchMove>();
  for (const move of moves) {
    const key = canonicalGroupKey(move.groupIds);
    const previous = byKey.get(key);
    if (!previous || compareMoves(move, previous) < 0) byKey.set(key, move);
  }
  return [...byKey.values()].sort(compareMoves);
}

function applyMove(
  state: SearchState,
  move: SearchMove,
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  objectiveByGroupId: ReadonlyMap<string, BoardNodeObjective>,
  groupIndexById: ReadonlyMap<string, number>,
): SearchState {
  const words = wordsWith(state.words, move.groupIds, groupIndexById);
  if (!words) throw new Error(`Board search move repeats a group in ${move.groupKey}`);
  const unlocked = new Set(state.unlocked);
  let spent = state.spent;
  let valueMicroUnits = state.valueMicroUnits;
  for (const groupId of move.groupIds) {
    unlocked.add(groupId);
    spent += nodeByGroupId.get(groupId)!.pointCost;
    valueMicroUnits += nodeValue(objectiveByGroupId.get(groupId)!);
  }
  return {
    unlocked,
    spent,
    valueMicroUnits,
    addedInOrder: [...state.addedInOrder, ...move.groupIds],
    words,
    key: words.join(","),
  };
}

type GreedyResult = Readonly<{
  final: SearchState;
  states: readonly SearchState[];
}>;

function pureGreedy(
  start: SearchState,
  budget: number,
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  objectiveByGroupId: ReadonlyMap<string, BoardNodeObjective>,
  adjacency: BoardAdjacency,
  catalogs: MechanicsCatalogs,
  playerLevel: number,
  positiveGroupIds: readonly string[],
  groupIndexById: ReadonlyMap<string, number>,
): GreedyResult {
  let state = start;
  const states: SearchState[] = [];
  while (state.spent < budget) {
    const moves = dedupeMoves([
      ...frontierMoves(
        state,
        budget - state.spent,
        nodeByGroupId,
        objectiveByGroupId,
        adjacency,
        catalogs,
        playerLevel,
      ),
      ...bundleMoves(
        state,
        budget - state.spent,
        positiveGroupIds,
        nodeByGroupId,
        objectiveByGroupId,
        adjacency,
        catalogs,
        playerLevel,
      ),
    ]).filter((move) => move.valueMicroUnits > 0 && move.cost > 0);
    if (moves.length === 0) return { final: state, states };
    state = applyMove(state, moves.sort(compareMoves)[0]!, nodeByGroupId, objectiveByGroupId, groupIndexById);
    states.push(state);
  }
  return { final: state, states };
}

function declaredStateConsistent(
  unlocked: ReadonlySet<string>,
  adjacency: BoardAdjacency,
): boolean {
  if (![...unlocked].every((groupId) => adjacency.neighborsByGroupId.has(groupId))) return false;
  const seen = new Set<string>([adjacency.startGroupId]);
  const pending: string[] = [adjacency.startGroupId];
  while (pending.length > 0) {
    const groupId = pending.shift()!;
    for (const neighbor of adjacency.neighborsByGroupId.get(groupId) ?? []) {
      if (unlocked.has(neighbor) && !seen.has(neighbor)) {
        seen.add(neighbor);
        pending.push(neighbor);
      }
    }
  }
  return [...unlocked].every((groupId) => seen.has(groupId));
}

function suggestionFromState(
  state: SearchState,
  initialUnlocked: ReadonlySet<string>,
  nodeByGroupId: ReadonlyMap<string, BoardNode>,
  objectiveByGroupId: ReadonlyMap<string, BoardNodeObjective>,
  adjacency: BoardAdjacency,
): BoardSuggestedUnlock[] {
  const unlocked = new Set(initialUnlocked);
  return state.addedInOrder.map((groupId, index) => {
    const objective = objectiveByGroupId.get(groupId)!;
    const parent = parentForGroup(groupId, unlocked, adjacency);
    unlocked.add(groupId);
    return {
      order: index + 1,
      nodeGroupId: groupId,
      nodeId: nodeByGroupId.get(groupId)!.id,
      kind: objective.kind,
      pointCost: objective.pointCost,
      valueMicroUnits: objective.valueMicroUnits,
      valueClass: objective.valueClass,
      appliesWhen: objective.appliesWhen,
      pathParentGroupId: parent,
    };
  });
}

export function suggestHolomemBoardNodes(input: HolomemBoardSuggestionInput): HolomemBoardSuggestion {
  assertInteger(input.holomemRank, "Holomem Rank");
  if (input.holomemRank < 1 || input.holomemRank > 50) throw new Error("Holomem Rank must be between 1 and 50");
  assertNonnegativeInteger(input.extraPointsOwned, "Extra Board points");
  assertNonnegativeInteger(input.playerLevel, "Board player level");

  const objectiveInput: HolomemBoardObjectiveInput = {
    team: input.team,
    focus: { talentId: input.talentId, position: input.focusPosition },
    unlockedNodeGroupIds: input.unlockedNodeGroupIds,
    playerLevel: input.playerLevel,
    ...(input.catalogs === undefined ? {} : { catalogs: input.catalogs }),
    ...(input.adjacency === undefined ? {} : { adjacency: input.adjacency }),
  };
  const objective = buildBoardNodeObjective(objectiveInput);
  const catalogs = input.catalogs ?? mechanicsData.catalogs;
  const adjacency = input.adjacency ?? boardAdjacency;
  const nodeByGroupId = new Map(
    objective.nodes.map((candidate) => [
      candidate.nodeGroupId,
      resolveNodeForFocus(candidate.nodeGroupId, input.talentId, catalogs),
    ]),
  );
  const initialUnlocked = new Set(input.unlockedNodeGroupIds);
  initialUnlocked.add(adjacency.startGroupId);
  if (![...initialUnlocked].every((groupId) => nodeByGroupId.has(groupId))) {
    throw new Error("Declared Board state contains an unknown node group");
  }
  const rankPointIncome = catalogs.holomemRankPoints
    .filter((row) => row.rank <= input.holomemRank)
    .reduce((total, row) => total + row.points, 0);
  const totalBudget = rankPointIncome + input.extraPointsOwned;
  const alreadySpent = [...initialUnlocked].reduce((total, groupId) => total + nodeByGroupId.get(groupId)!.pointCost, 0);
  const available = totalBudget - alreadySpent;
  if (available < 0) throw new Error("Declared Board state exceeds the available point budget");

  const objectiveByGroupId = objective.objectiveByGroupId;
  const groupIndexById = buildGroupIndex(adjacency);
  const initialWords = wordsForGroups(initialUnlocked, groupIndexById);
  const initialState: SearchState = {
    unlocked: initialUnlocked,
    spent: alreadySpent,
    valueMicroUnits: 0,
    addedInOrder: [],
    words: initialWords,
    key: initialWords.join(","),
  };
  const positiveGroupIds = objective.nodes
    .filter((node) => node.valueMicroUnits !== null && node.valueMicroUnits > 0 && !initialUnlocked.has(node.nodeGroupId))
    .map((node) => node.nodeGroupId)
    .sort();
  const greedy = pureGreedy(
    initialState,
    totalBudget,
    nodeByGroupId,
    objectiveByGroupId,
    adjacency,
    catalogs,
    input.playerLevel,
    positiveGroupIds,
    groupIndexById,
  );

  // Provable-optimum short-circuit: the sum of every positive-value, visible,
  // still-locked node is an upper bound no search can exceed. When the greedy
  // pass already reaches it (typically a budget that covers the whole board -
  // the most expensive case for the beam), skip the beam entirely.
  const upperBoundMicroUnits = [...objectiveByGroupId.entries()].reduce((total, [groupId, groupObjective]) => {
    if (initialState.unlocked.has(groupId)) return total;
    const node = nodeByGroupId.get(groupId)!;
    if (!isVisible(node, input.playerLevel, catalogs)) return total;
    const value = nodeValue(groupObjective);
    return value > 0 ? total + value : total;
  }, 0);
  const greedyIsProvablyComplete = greedy.final.valueMicroUnits === upperBoundMicroUnits;

  let beam: SearchState[] = greedyIsProvablyComplete ? [] : [initialState];
  let incumbent = greedyIsProvablyComplete ? greedy.final : initialState;
  let statesExplored = 0;
  let iteration = 0;
  // Candidates stay light until they survive beam selection: a full state
  // (cloned Set + order array) is built only for the <= 64 survivors, not for
  // every explored move. Ranking and dedup need only value, spent, and the
  // bitset key.
  type LightCandidate = Readonly<{
    ready: SearchState | null;
    parent: SearchState | null;
    move: SearchMove | null;
    spent: number;
    valueMicroUnits: number;
    words: readonly number[];
    key: string;
  }>;
  const compareCandidateRank = (left: LightCandidate, right: LightCandidate): number => {
    const ratio = compareIntegerRatio(left.valueMicroUnits, left.spent, right.valueMicroUnits, right.spent);
    if (ratio !== 0) return ratio;
    if (left.valueMicroUnits !== right.valueMicroUnits) return left.valueMicroUnits > right.valueMicroUnits ? -1 : 1;
    if (left.spent !== right.spent) return left.spent - right.spent;
    return compareUnlockedMembership(left.words, right.words);
  };
  const materialize = (candidate: LightCandidate): SearchState =>
    candidate.ready ?? applyMove(candidate.parent!, candidate.move!, nodeByGroupId, objectiveByGroupId, groupIndexById);

  while (beam.length > 0) {
    const nextByKey = new Map<string, LightCandidate>();
    let hasPositiveMove = false;
    for (const state of beam) {
      const remaining = totalBudget - state.spent;
      if (remaining < 0) continue;
      const moves = dedupeMoves([
        ...frontierMoves(state, remaining, nodeByGroupId, objectiveByGroupId, adjacency, catalogs, input.playerLevel),
        ...bundleMoves(
          state,
          remaining,
          positiveGroupIds,
          nodeByGroupId,
          objectiveByGroupId,
          adjacency,
          catalogs,
          input.playerLevel,
        ),
      ]);
      statesExplored += moves.length;
      for (const move of moves) {
        if (move.valueMicroUnits > 0) hasPositiveMove = true;
        const words = wordsWith(state.words, move.groupIds, groupIndexById);
        if (!words) throw new Error(`Board search move repeats a group in ${move.groupKey}`);
        const candidate: LightCandidate = {
          ready: null,
          parent: state,
          move,
          spent: state.spent + move.cost,
          valueMicroUnits: state.valueMicroUnits + move.valueMicroUnits,
          words,
          key: words.join(","),
        };
        const previous = nextByKey.get(candidate.key);
        if (!previous || compareCandidateRank(candidate, previous) < 0) nextByKey.set(candidate.key, candidate);
      }
    }
    const protectedGreedyState = greedy.states[Math.min(iteration, Math.max(0, greedy.states.length - 1))];
    if (protectedGreedyState) {
      const greedyCandidate: LightCandidate = {
        ready: protectedGreedyState,
        parent: null,
        move: null,
        spent: protectedGreedyState.spent,
        valueMicroUnits: protectedGreedyState.valueMicroUnits,
        words: protectedGreedyState.words,
        key: protectedGreedyState.key,
      };
      const previous = nextByKey.get(greedyCandidate.key);
      if (!previous || compareCandidateRank(greedyCandidate, previous) < 0) {
        nextByKey.set(greedyCandidate.key, greedyCandidate);
      }
      if (compareStateValue(protectedGreedyState, incumbent) < 0) incumbent = protectedGreedyState;
    }
    if (nextByKey.size === 0) break;
    const ranked = [...nextByKey.values()].sort(compareCandidateRank);
    let selected: LightCandidate[];
    if (protectedGreedyState && !ranked.slice(0, BOARD_SUGGESTER_BEAM_WIDTH).some((candidate) => candidate.key === protectedGreedyState.key)) {
      const greedyCandidate = nextByKey.get(protectedGreedyState.key)!;
      selected = [greedyCandidate, ...ranked.filter((candidate) => candidate.key !== protectedGreedyState.key).slice(0, BOARD_SUGGESTER_BEAM_WIDTH - 1)];
    } else {
      selected = ranked.slice(0, BOARD_SUGGESTER_BEAM_WIDTH);
    }
    beam = selected.map(materialize);
    for (const state of beam) {
      if (compareStateValue(state, incumbent) < 0) incumbent = state;
    }
    iteration += 1;
    if (!hasPositiveMove) break;
  }

  if (incumbent.valueMicroUnits < greedy.final.valueMicroUnits) {
    throw new Error("Budgeted-connected beam fell below the pure greedy baseline");
  }
  const suggestedUnlocks = suggestionFromState(
    incumbent,
    initialUnlocked,
    nodeByGroupId,
    objectiveByGroupId,
    adjacency,
  );
  const selectedMicroUnits = suggestedUnlocks.reduce((total, node) => total + (node.valueMicroUnits ?? 0), 0);
  if (selectedMicroUnits !== incumbent.valueMicroUnits) throw new Error("Board suggestion objective reconciliation failed");

  return {
    claim: BOARD_SUGGESTER_CLAIM,
    stackingModel: BOARD_SUGGESTER_STACKING_MODEL,
    budget: {
      holomemRank: input.holomemRank,
      rankPointIncome,
      extraPointsOwned: input.extraPointsOwned,
      totalBudget,
      alreadySpent,
      available,
    },
    boardDiagnostics: {
      declaredStateConsistentWithDerivedAdjacency: declaredStateConsistent(initialUnlocked, adjacency),
    },
    objective,
    suggestedUnlocks,
    search: {
      algorithm: "budgeted-connected-beam",
      beamWidth: BOARD_SUGGESTER_BEAM_WIDTH,
      statesExplored,
      greedyBaselineMicroUnits: greedy.final.valueMicroUnits,
      selectedMicroUnits,
    },
  };
}

export const buildHolomemBoardSuggestion = suggestHolomemBoardNodes;
export const suggestBoardNodes = suggestHolomemBoardNodes;
