import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const MECHANICS_PATH = "data/generated/holodori-mechanics.json";
const OUTPUT_PATH = "data/native/holomem-board-model-v1.json";

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function resolveNode(rows, groupId, talentId) {
  const groupRows = rows.filter((row) => row.groupId === groupId);
  if (groupRows.length === 0) throw new Error(`Board node group ${groupId} is missing`);
  if (groupRows.length === 1) return groupRows[0];
  const matches = groupRows.filter((row) => row.characterIds.includes(talentId));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error(`Board node group ${groupId} has ambiguous talent matches for ${talentId}`);
  const defaults = groupRows.filter((row) => row.characterIds.length === 0);
  if (defaults.length === 1) return defaults[0];
  if (defaults.length > 1) throw new Error(`Board node group ${groupId} has ambiguous defaults`);
  throw new Error(`Board node group ${groupId} is unresolved for talent ${talentId}`);
}

function edgesFor(cells) {
  const groupIds = [...cells.keys()].sort();
  const edges = [];
  for (const left of groupIds) {
    for (const right of groupIds) {
      if (left >= right) continue;
      const a = cells.get(left);
      const b = cells.get(right);
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) edges.push(`${left}~${right}`);
    }
  }
  return edges;
}

function assertConnected(edges, groupIds) {
  const neighbors = new Map(groupIds.map((groupId) => [groupId, []]));
  for (const edge of edges) {
    const [left, right] = edge.split("~");
    neighbors.get(left).push(right);
    neighbors.get(right).push(left);
  }
  if (!neighbors.has("S-001")) throw new Error("Board start group S-001 is missing");
  const seen = new Set(["S-001"]);
  const pending = ["S-001"];
  while (pending.length) {
    for (const neighbor of neighbors.get(pending.shift())) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        pending.push(neighbor);
      }
    }
  }
  if (seen.size !== groupIds.length) throw new Error("Board adjacency is not connected from S-001");
}

const mechanicsBytes = await readFile(MECHANICS_PATH);
const mechanics = JSON.parse(mechanicsBytes.toString("utf8"));
const { boardNodes, boardNodePositions, boardPointPools, holomemRankPoints } = mechanics.catalogs;
const groupIds = [...new Set(boardNodes.map((node) => node.groupId))].sort();
if (groupIds.length !== 152) throw new Error(`Expected 152 board groups; received ${groupIds.length}`);

const models = new Map();
for (const position of boardNodePositions) {
  const cells = models.get(position.treeModelId) ?? new Map();
  if (cells.has(position.nodeGroupId)) throw new Error(`Duplicate board group ${position.nodeGroupId}`);
  const cellKey = `${position.x},${position.y}`;
  if ([...cells.values()].some((cell) => `${cell.x},${cell.y}` === cellKey)) throw new Error(`Duplicate board cell ${cellKey}`);
  cells.set(position.nodeGroupId, { x: position.x, y: position.y });
  models.set(position.treeModelId, cells);
}
if (models.size !== 4) throw new Error(`Expected 4 board models; received ${models.size}`);
const sortedModels = [...models.entries()].sort(([left], [right]) => left.localeCompare(right));
for (const [id, cells] of sortedModels) {
  if (cells.size !== 152 || [...cells.keys()].sort().join("|") !== groupIds.join("|")) {
    throw new Error(`Board model ${id} does not have the canonical 152 groups`);
  }
}
const edgeSets = sortedModels.map(([, cells]) => edgesFor(cells));
const edges = edgeSets[0];
if (edges.length !== 171) throw new Error(`Expected 171 board edges; received ${edges.length}`);
if (edgeSets.some((candidate) => candidate.join("|") !== edges.join("|"))) throw new Error("Board adjacencies differ by model");
assertConnected(edges, groupIds);

const rankIncome = holomemRankPoints.reduce((total, row) => total + row.points, 0);
if (rankIncome !== 361) throw new Error(`Expected 361 rank income; received ${rankIncome}`);
for (const pool of boardPointPools) {
  const nodes = groupIds.map((groupId) => resolveNode(boardNodes, groupId, pool.talentId));
  const wholeCost = nodes.reduce((total, node) => total + node.pointCost, 0);
  const scopeCost = nodes.filter((node) => ["leader", "card", "connection"].includes(node.kind))
    .reduce((total, node) => total + node.pointCost, 0);
  if (wholeCost !== 447 || scopeCost !== 301) throw new Error(`Board budget drifted for ${pool.talentId}`);
}

const model = {
  schemaVersion: 1,
  id: "holomem-board-model-v1",
  methodologyVersion: "yd-holomem-board-1.0.0",
  mechanics: { path: MECHANICS_PATH, sha256: createHash("sha256").update(mechanicsBytes).digest("hex") },
  adjacency: {
    ruleId: "board-derived-adjacency",
    derivation: "orthogonal-unit-neighbors-on-position-grid",
    startGroupId: "S-001",
    nodeGroupCount: 152,
    edgeCount: 171,
    edgeSetSha256: sha256(edges),
    treeModels: sortedModels.map(([id, cells]) => ({
      id,
      cellsSha256: sha256([...cells.entries()].map(([groupId, cell]) => ({ groupId, ...cell }))
        .sort((left, right) => left.groupId.localeCompare(right.groupId))),
    })),
    identicalAcrossTreeModels: true,
    connectedFromStart: true,
    evidenceGrade: "corroborated",
  },
  budget: { maxRankIncome: 361, wholeBoardCostPerMember: 447, inScopeCost: 301 },
  assumptions: [
    { id: "unit-connect-independence", default: "independent-user-confirmed", evidence: "user-confirmed", statement: "User confirmed 2026-08-08; simultaneous active-unit and Connect use is not source-documented." },
    { id: "extra-point-income", default: "user-declared", evidence: "unresolved", statement: "Income beyond rank points is unresolved and must be declared by the user." },
    { id: "board-stat-stacking", default: "additive-envelope-not-jointly-attainable", evidence: "unresolved", statement: "Board stat boosts use an additive envelope and are not claimed jointly attainable." },
    { id: "talent-to-tree-model", default: "tree-model-001", evidence: "unresolved", statement: "Talent-to-tree-model mapping defaults to tree-model-001; adjacency is model-invariant." },
    { id: "connect-amplification", default: "multiplier-total", evidence: "unresolved", statement: "Connect amplification defaults to multiplier-total." },
    { id: "connect-overlap", default: "independent-additive", evidence: "unresolved", statement: "Overlapping Connect amplification defaults to independent-additive." },
    { id: "cross-board-connect-restriction", default: "one-card-per-board-placement", evidence: "corroborated", statement: "A Connect card cannot be placed on more than one member board." },
  ],
  nonClaims: [
    "Node suggestions are bounded-search results; no optimality or exhaustiveness is claimed.",
    "No absolute stat totals or Live Score effect is published.",
    "Adjacency is derived from grid geometry; the game publishes no prerequisite table.",
    "Unit-Connect independence is user-confirmed, not source-documented; only cross-board exclusivity is corroborated.",
    "Other modeling assumptions are explicitly labeled.",
  ],
};
const modelHash = sha256(model);
await writeFile(OUTPUT_PATH, `${JSON.stringify({ ...model, modelHash }, null, 2)}\n`, "utf8");
console.log(`holomem-board modelHash ${modelHash}`);
