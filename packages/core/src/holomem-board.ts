import { createHash } from "node:crypto";

import boardModelJson from "../../../data/native/holomem-board-model-v1.json";
import { z } from "zod";

import { mechanicsData, type MechanicsData } from "./mechanics";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const REVIEWED_MECHANICS_SHA256 = "b9b8847b3860e719ca42a11ed86f4b87a9a60baa302ffdf57787d86bbc06695d";
const REVIEWED_ASSUMPTIONS = [
  { id: "unit-connect-independence", default: "independent-user-confirmed", evidence: "user-confirmed", statement: "User confirmed 2026-08-08; simultaneous active-unit and Connect use is not source-documented." },
  { id: "extra-point-income", default: "user-declared", evidence: "unresolved", statement: "Income beyond rank points is unresolved and must be declared by the user." },
  { id: "board-stat-stacking", default: "additive-envelope-not-jointly-attainable", evidence: "unresolved", statement: "Board stat boosts use an additive envelope and are not claimed jointly attainable." },
  { id: "talent-to-tree-model", default: "tree-model-001", evidence: "unresolved", statement: "Talent-to-tree-model mapping defaults to tree-model-001; adjacency is model-invariant." },
  { id: "connect-amplification", default: "multiplier-total", evidence: "unresolved", statement: "Connect amplification defaults to multiplier-total." },
  { id: "connect-overlap", default: "independent-additive", evidence: "unresolved", statement: "Overlapping Connect amplification defaults to independent-additive." },
  { id: "cross-board-connect-restriction", default: "one-card-per-board-placement", evidence: "corroborated", statement: "A Connect card cannot be placed on more than one member board." },
] as const;
const REVIEWED_NON_CLAIMS = [
  "Node suggestions are bounded-search results; no optimality or exhaustiveness is claimed.",
  "No absolute stat totals or Live Score effect is published.",
  "Adjacency is derived from grid geometry; the game publishes no prerequisite table.",
  "Unit-Connect independence is user-confirmed, not source-documented; only cross-board exclusivity is corroborated.",
  "Other modeling assumptions are explicitly labeled.",
] as const;

const AssumptionSchema = z.object({
  id: z.string().min(1),
  default: z.string().min(1),
  evidence: z.enum(["user-confirmed", "corroborated", "unresolved"]),
  statement: z.string().min(1),
}).strict();

export const HolomemBoardModelSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.literal("holomem-board-model-v1"),
  methodologyVersion: z.literal("yd-holomem-board-1.0.0"),
  mechanics: z.object({
    path: z.literal("data/generated/holodori-mechanics.json"),
    sha256: HashSchema,
  }).strict(),
  adjacency: z.object({
    ruleId: z.literal("board-derived-adjacency"),
    derivation: z.literal("orthogonal-unit-neighbors-on-position-grid"),
    startGroupId: z.literal("S-001"),
    nodeGroupCount: z.literal(152),
    edgeCount: z.literal(171),
    edgeSetSha256: HashSchema,
    treeModels: z.array(z.object({ id: z.string().min(1), cellsSha256: HashSchema }).strict()).length(4),
    identicalAcrossTreeModels: z.literal(true),
    connectedFromStart: z.literal(true),
    evidenceGrade: z.literal("corroborated"),
  }).strict(),
  budget: z.object({
    maxRankIncome: z.literal(361),
    wholeBoardCostPerMember: z.literal(447),
    inScopeCost: z.literal(301),
  }).strict(),
  assumptions: z.array(AssumptionSchema).min(1),
  nonClaims: z.array(z.string().min(1)).min(1),
  modelHash: HashSchema,
}).strict();

export type HolomemBoardModel = z.infer<typeof HolomemBoardModelSchema>;
export type BoardNode = MechanicsData["catalogs"]["boardNodes"][number];
export type BoardGridCell = Readonly<{ x: number; y: number }>;
export type BoardAdjacency = Readonly<{
  ruleId: "board-derived-adjacency";
  startGroupId: "S-001";
  treeModelIds: readonly string[];
  cellByGroupIdByTreeModel: ReadonlyMap<string, ReadonlyMap<string, BoardGridCell>>;
  neighborsByGroupId: ReadonlyMap<string, readonly string[]>;
  nodeGroupCount: 152;
  edgeCount: 171;
}>;

type MechanicsCatalogs = MechanicsData["catalogs"];

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function sortedEdges(cells: ReadonlyMap<string, BoardGridCell>): string[] {
  const groupIds = [...cells.keys()].sort();
  const edges: string[] = [];
  for (const left of groupIds) {
    const leftCell = cells.get(left)!;
    for (const right of groupIds) {
      if (left >= right) continue;
      const rightCell = cells.get(right)!;
      if (Math.abs(leftCell.x - rightCell.x) + Math.abs(leftCell.y - rightCell.y) === 1) {
        edges.push(`${left}~${right}`);
      }
    }
  }
  return edges;
}

function assertConnected(startGroupId: string, neighborsByGroupId: ReadonlyMap<string, readonly string[]>): void {
  if (!neighborsByGroupId.has(startGroupId)) throw new Error(`Board start group ${startGroupId} is missing`);
  const seen = new Set<string>([startGroupId]);
  const pending = [startGroupId];
  while (pending.length > 0) {
    const groupId = pending.shift()!;
    for (const neighbor of neighborsByGroupId.get(groupId) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        pending.push(neighbor);
      }
    }
  }
  if (seen.size !== neighborsByGroupId.size) {
    throw new Error(`Board adjacency is not connected from ${startGroupId}`);
  }
}

export function buildBoardAdjacency(catalogs: MechanicsCatalogs = mechanicsData.catalogs): BoardAdjacency {
  const expectedGroupIds = [...new Set(catalogs.boardNodes.map((node) => node.groupId))].sort();
  if (expectedGroupIds.length !== 152) {
    throw new Error(`Board model must have exactly 152 node groups; received ${expectedGroupIds.length}`);
  }

  const positionsByModel = new Map<string, Map<string, BoardGridCell>>();
  for (const position of catalogs.boardNodePositions) {
    const byGroup = positionsByModel.get(position.treeModelId) ?? new Map<string, BoardGridCell>();
    if (byGroup.has(position.nodeGroupId)) {
      throw new Error(`Board model ${position.treeModelId} has duplicate group ${position.nodeGroupId}`);
    }
    byGroup.set(position.nodeGroupId, { x: position.x, y: position.y });
    positionsByModel.set(position.treeModelId, byGroup);
  }
  if (positionsByModel.size !== 4) {
    throw new Error(`Board model must have exactly 4 tree models; received ${positionsByModel.size}`);
  }

  const edgeSets: string[][] = [];
  for (const [treeModelId, cells] of [...positionsByModel.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (cells.size !== 152) {
      throw new Error(`Board model ${treeModelId} must have exactly 152 groups; received ${cells.size}`);
    }
    if ([...cells.keys()].sort().join("|") !== expectedGroupIds.join("|")) {
      throw new Error(`Board model ${treeModelId} does not have the canonical group set`);
    }
    const occupied = new Set<string>();
    for (const cell of cells.values()) {
      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) throw new Error(`Board model ${treeModelId} has duplicate cell ${key}`);
      occupied.add(key);
    }
    edgeSets.push(sortedEdges(cells));
  }

  const canonicalEdges = edgeSets[0]!;
  if (canonicalEdges.length !== 171) {
    throw new Error(`Board adjacency must have exactly 171 edges; received ${canonicalEdges.length}`);
  }
  if (edgeSets.some((edges) => edges.join("|") !== canonicalEdges.join("|"))) {
    throw new Error("Board adjacency differs across tree models");
  }
  const neighbors = new Map(expectedGroupIds.map((groupId) => [groupId, [] as string[]]));
  for (const edge of canonicalEdges) {
    const [left, right] = edge.split("~") as [string, string];
    neighbors.get(left)!.push(right);
    neighbors.get(right)!.push(left);
  }
  const neighborsByGroupId = new Map(
    [...neighbors.entries()].map(([groupId, groupNeighbors]) => [groupId, groupNeighbors.sort() as readonly string[]]),
  );
  assertConnected("S-001", neighborsByGroupId);
  if (sha256(canonicalEdges) !== holomemBoardModel.adjacency.edgeSetSha256) {
    throw new Error("Board adjacency does not match the canonical evidence edge digest");
  }

  return {
    ruleId: "board-derived-adjacency",
    startGroupId: "S-001",
    treeModelIds: [...positionsByModel.keys()].sort(),
    cellByGroupIdByTreeModel: new Map(
      [...positionsByModel.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([treeModelId, cells]) => [
          treeModelId,
          new Map([...cells.entries()].sort(([left], [right]) => left.localeCompare(right))),
        ]),
    ),
    neighborsByGroupId,
    nodeGroupCount: 152,
    edgeCount: 171,
  };
}

export function resolveBoardNodeForTalent(
  groupId: string,
  talentId: string,
  catalogs: MechanicsCatalogs = mechanicsData.catalogs,
): BoardNode {
  const rows = catalogs.boardNodes.filter((node) => node.groupId === groupId);
  if (rows.length === 0) throw new Error(`Board node group ${groupId} is missing`);
  if (rows.length === 1) return rows[0]!;

  const matches = rows.filter((node) => node.characterIds.includes(talentId));
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) throw new Error(`Board node group ${groupId} has ambiguous talent matches for ${talentId}`);

  const defaults = rows.filter((node) => node.characterIds.length === 0);
  if (defaults.length === 1) return defaults[0]!;
  if (defaults.length > 1) throw new Error(`Board node group ${groupId} has ambiguous defaults`);
  throw new Error(`Board node group ${groupId} is unresolved for talent ${talentId}`);
}

export function computeHolomemBoardModelHash(model: Omit<HolomemBoardModel, "modelHash">): string {
  return sha256(model);
}

export function assertHolomemBoardModelValid(model: HolomemBoardModel, catalogs: MechanicsCatalogs = mechanicsData.catalogs): void {
  const { modelHash, ...withoutHash } = model;
  if (computeHolomemBoardModelHash(withoutHash) !== modelHash) {
    throw new Error("Holomem Board model hash does not match its canonical manifest");
  }
  if (model.mechanics.sha256 !== REVIEWED_MECHANICS_SHA256) {
    throw new Error("Holomem Board mechanics SHA-256 does not match the reviewed artifact");
  }
  if (canonicalize(model.assumptions) !== canonicalize(REVIEWED_ASSUMPTIONS)) {
    throw new Error("Holomem Board assumptions do not match the reviewed declarations");
  }
  if (canonicalize(model.nonClaims) !== canonicalize(REVIEWED_NON_CLAIMS)) {
    throw new Error("Holomem Board non-claims do not match the reviewed declarations");
  }
  const rule = mechanicsData.runtimeRules.find((candidate) => candidate.id === model.adjacency.ruleId);
  if (rule?.status !== model.adjacency.evidenceGrade) {
    throw new Error("Holomem Board adjacency rule does not match the mechanics catalog");
  }

  const adjacency = buildBoardAdjacency(catalogs);
  const edgeSet = sortedEdges(adjacency.cellByGroupIdByTreeModel.get(adjacency.treeModelIds[0]!)!);
  if (sha256(edgeSet) !== model.adjacency.edgeSetSha256) {
    throw new Error("Holomem Board edge digest does not match derived adjacency");
  }
  const treeModels = adjacency.treeModelIds.map((id) => ({
    id,
    cellsSha256: sha256([...adjacency.cellByGroupIdByTreeModel.get(id)!.entries()]
      .map(([groupId, cell]) => ({ groupId, ...cell }))
      .sort((left, right) => left.groupId.localeCompare(right.groupId))),
  }));
  if (canonicalize(treeModels) !== canonicalize(model.adjacency.treeModels)) {
    throw new Error("Holomem Board cell digests do not match derived positions");
  }

  const rankIncome = catalogs.holomemRankPoints.reduce((total, row) => total + row.points, 0);
  if (rankIncome !== model.budget.maxRankIncome) throw new Error("Holomem Board rank budget drifted");
  const groupIds = [...new Set(catalogs.boardNodes.map((node) => node.groupId))];
  for (const pool of catalogs.boardPointPools) {
    const nodes = groupIds.map((groupId) => resolveBoardNodeForTalent(groupId, pool.talentId, catalogs));
    const wholeBoardCost = nodes.reduce((total, node) => total + node.pointCost, 0);
    const inScopeCost = nodes
      .filter((node) => node.kind === "leader" || node.kind === "card" || node.kind === "connection")
      .reduce((total, node) => total + node.pointCost, 0);
    if (wholeBoardCost !== model.budget.wholeBoardCostPerMember || inScopeCost !== model.budget.inScopeCost) {
      throw new Error(`Holomem Board budget drifted for talent ${pool.talentId}`);
    }
  }
}

export const holomemBoardModel = HolomemBoardModelSchema.parse(boardModelJson);
assertHolomemBoardModelValid(holomemBoardModel);
export const boardAdjacency = buildBoardAdjacency();
