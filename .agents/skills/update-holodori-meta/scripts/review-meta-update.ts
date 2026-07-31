import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type VerificationState =
  | "verified"
  | "corroborated"
  | "research-only"
  | "disputed";
type Reason =
  | "direct-change"
  | "new-synergy"
  | "chart-meta"
  | "new-evidence"
  | "methodology-correction";
type Source = {
  id: string;
  title: string;
  kind: string;
  reusePolicy: string;
  upstreamVersion: string;
  verificationState: VerificationState;
};
type Attribution = { reason: Reason; delta: number };
type Change = {
  dataset: string;
  recordId: string;
  field: string;
  proposedValue: unknown;
  sourceIds: string[];
  upstreamVersion: string;
  retrievedAt: string;
  patchId: string;
  verificationState: VerificationState;
  confidence: number;
  reason: Reason;
  scoreDelta?: number;
  attributions?: Attribution[];
};
type Candidate = {
  patchId: string;
  methodologyVersion: string;
  changes: Change[];
};

const allowedDatasets = new Set([
  "sources",
  "assets",
  "patches",
  "talents",
  "skills",
  "cards",
  "leaders",
  "guides",
]);
const reasons = new Set<Reason>([
  "direct-change",
  "new-synergy",
  "chart-meta",
  "new-evidence",
  "methodology-correction",
]);
const root = process.cwd();

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
}

function getField(record: unknown, field: string): unknown {
  return field.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    const key = /^\d+$/.test(segment) ? Number(segment) : segment;
    return (current as Record<string | number, unknown>)[key];
  }, record);
}

function isNumericChange(before: unknown, after: unknown) {
  return (
    typeof before === "number" ||
    typeof after === "number" ||
    (Array.isArray(before) &&
      Array.isArray(after) &&
      [...before, ...after].some((value) => typeof value === "number"))
  );
}

const candidatePath = option("--candidate");
if (!candidatePath) throw new Error("Pass --candidate with a review manifest");
const candidate = readJson<Candidate>(candidatePath);
if (!candidate.patchId || !candidate.methodologyVersion) {
  throw new Error("Candidate requires patchId and methodologyVersion");
}
if (!Array.isArray(candidate.changes) || candidate.changes.length === 0) {
  throw new Error("Candidate requires at least one proposed change");
}

const sources = readJson<Source[]>("data/sources.json");
const rankingSource = readFileSync(
  resolve(root, "packages/core/src/ranking.ts"),
  "utf8",
);
const seedMatch = rankingSource.match(/RESEARCH_SEED\s*=\s*(\d+)/);
if (!seedMatch) throw new Error("Cannot resolve the repository ranking seed");
const fixedSeed = Number(seedMatch[1]);
const sourceById = new Map(sources.map((source) => [source.id, source]));
const datasetCache = new Map<string, unknown[]>();
const reviewed = candidate.changes.map((change) => {
  if (!allowedDatasets.has(change.dataset)) {
    throw new Error(`Unsupported dataset ${change.dataset}`);
  }
  if (!reasons.has(change.reason)) {
    throw new Error(`Unsupported attribution reason ${change.reason}`);
  }
  if (
    !["verified", "corroborated"].includes(change.verificationState) ||
    change.confidence < 0 ||
    change.confidence > 1
  ) {
    throw new Error(
      `${change.dataset}/${change.recordId}.${change.field} cannot promote unverified evidence`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(change.retrievedAt)) {
    throw new Error("retrievedAt must be an ISO date");
  }
  if (!change.upstreamVersion || !change.patchId) {
    throw new Error("Every change requires upstreamVersion and patchId");
  }
  const records =
    datasetCache.get(change.dataset) ??
    readJson<unknown[]>(`data/${change.dataset}.json`);
  datasetCache.set(change.dataset, records);
  const record = records.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { id?: string }).id === change.recordId,
  );
  if (!record) throw new Error(`Missing record ${change.dataset}/${change.recordId}`);
  const before = getField(record, change.field);
  if (before === undefined) {
    throw new Error(`Missing field ${change.dataset}/${change.recordId}.${change.field}`);
  }
  if (!Array.isArray(change.sourceIds) || change.sourceIds.length === 0) {
    throw new Error("Every change requires at least one source ID");
  }
  const evidence = change.sourceIds.map((id) => {
    const source = sourceById.get(id);
    if (!source) throw new Error(`Missing source ${id}`);
    if (
      source.kind === "change-signal" ||
      source.reusePolicy === "no-redistribution-without-license"
    ) {
      throw new Error(
        `REFUSED ${id}: change signals and unlicensed data cannot supply normalized values`,
      );
    }
    if (!["verified", "corroborated"].includes(source.verificationState)) {
      throw new Error(`REFUSED ${id}: source is ${source.verificationState}`);
    }
    return source;
  });
  if (isNumericChange(before, change.proposedValue)) {
    const authoritative = evidence.some(
      (source) =>
        source.kind === "official" ||
        (source.kind === "licensed-community" &&
          source.reusePolicy === "licensed-data"),
    );
    const corroboratedGuides =
      evidence.filter((source) => source.kind === "independent-guide").length >= 2;
    if (!authoritative && !corroboratedGuides) {
      throw new Error(
        `REFUSED ${change.dataset}/${change.recordId}.${change.field}: numerical evidence is not official, licensed, or independently corroborated`,
      );
    }
  }
  if (change.scoreDelta !== undefined) {
    if (!Array.isArray(change.attributions) || change.attributions.length === 0) {
      throw new Error("A scoreDelta requires attributed parts");
    }
    const total = change.attributions.reduce((sum, item) => {
      if (!reasons.has(item.reason)) {
        throw new Error(`Unsupported score attribution ${item.reason}`);
      }
      return sum + item.delta;
    }, 0);
    if (Math.abs(total - change.scoreDelta) > 1e-9) {
      throw new Error(
        `Attributed deltas must sum exactly (${total} != ${change.scoreDelta})`,
      );
    }
  }
  return {
    target: `${change.dataset}/${change.recordId}.${change.field}`,
    before,
    after: change.proposedValue,
    patchId: change.patchId,
    proposedUpstreamVersion: change.upstreamVersion,
    verificationState: change.verificationState,
    confidence: change.confidence,
    sources: evidence.map((source) => ({
      id: source.id,
      upstreamVersion: source.upstreamVersion,
    })),
    attribution: {
      reason: change.reason,
      scoreDelta: change.scoreDelta ?? null,
      parts: change.attributions ?? [],
    },
  };
});

reviewed.sort((left, right) => left.target.localeCompare(right.target));
console.log(
  JSON.stringify(
    {
      status: "review-required-no-files-changed",
      patchId: candidate.patchId,
      methodologyVersion: candidate.methodologyVersion,
      diff: reviewed,
      recalculation: {
        fixedSeedRequired: true,
        fixedSeed,
        commands: [
          "pnpm data:validate",
          "pnpm rankings:generate",
          "pnpm rankings:generate",
        ],
        requirement:
          "Both ranking runs must report the same seed and SHA-256 digest.",
      },
      changelog: reviewed.map((item) => ({
        target: item.target,
        reason: item.attribution.reason,
        scoreDelta: item.attribution.scoreDelta,
        parts: item.attribution.parts,
      })),
      publication: "blocked-pending-human-review",
    },
    null,
    2,
  ),
);
