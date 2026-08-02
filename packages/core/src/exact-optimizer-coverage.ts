import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertLegalFormation,
  evaluateTrigger,
  resolveActiveApplications,
  resolveLeaderApplications,
  resolveTargetRecipients,
  type LegalFormation,
  type TriggerObservation,
} from "./formation-evaluator";
import {
  canPruneByStrictCentralUpperBound,
  canonicalUtilityTie,
  toCanonicalMicroUnits,
} from "./exact-optimizer-arithmetic";
import { compileNativeLeaderRootBounds } from "./native-global-bound";
import { countNativeLegalTeamSets, searchNativeGlobalTeams } from "./native-global-search";
import { crossCheckExactOptimizerTeamLeader, compileExactOptimizerTeam } from "./exact-optimizer-kernel";
import { proveNativeLeaderEquivalenceCoverage } from "./exact-optimizer-leader-proof";
import { mechanicsData, type CardMechanics } from "./mechanics";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import { publicCards } from "./public-data";
import { songContextData } from "./song-contexts";
import { exactOptimizerScope } from "./exact-optimizer-scope";
import { EXACT_OPTIMIZER_KERNEL_VERSION } from "./exact-optimizer-kernel";
import { EXACT_OPTIMIZER_TRACE_VERSION } from "./exact-optimizer-trace";
import {
  isFullExactOptimizerTraceParity,
  type ExactOptimizerTraceParitySummary,
} from "./exact-optimizer-parity";

export const EXACT_OPTIMIZER_COVERAGE_VERSION = "yd-exact-kernel-coverage-1.1.0" as const;

type Application = CardMechanics["leaderOutfit"]["applications"][number];
type ApplicationRecord = Readonly<{
  recordId: string;
  cardId: string;
  source: "leader" | "active" | "passive" | "special";
  level: number | null;
  application: Application;
}>;

type CoverageEntry = Readonly<{
  key: string;
  count: number;
  recordIds: readonly string[];
  caseIds: readonly string[];
}>;

type CoverageAxis = Readonly<{
  id: string;
  entries: readonly CoverageEntry[];
}>;

type CoverageExecution = Readonly<{
  applicationCaseIdsByRecordId: ReadonlyMap<string, readonly string[]>;
  branchCaseIdsByKey: ReadonlyMap<string, readonly string[]>;
  compressionCaseIds: readonly string[];
  compressionParityMismatches: number;
  legalBoundaryCaseIds: readonly string[];
  roundingBoundaryCaseIds: readonly string[];
  parallelCaseIds: readonly string[];
  leaderProof: ReturnType<typeof proveNativeLeaderEquivalenceCoverage>;
  boundCaseIds: readonly string[];
  boundsAuthorized: boolean;
}>;

type CompressionParityCaseResult = Readonly<{
  caseId: string;
  canonicalUtility: Readonly<{ lower: number; central: number; upper: number }>;
  mode: "trace-preserving-state-runs" | "uncompressed-reference";
}>;

export type ExactOptimizerParallelExecutionEvidence = Readonly<{
  kind: "exact-optimizer-independent-parallel-evidence";
  workerCount: number;
  caseIds: readonly string[];
  serialDigest: string;
  parallelDigest: string;
  matched: boolean;
}>;

type CompressionParitySlice = Readonly<{
  results: readonly CompressionParityCaseResult[];
  mismatchCount: number;
}>;

export type ExactOptimizerCoverageLedger = Readonly<{
  schemaVersion: 1;
  kind: "exact-optimizer-coverage";
  methodologyVersion: typeof EXACT_OPTIMIZER_COVERAGE_VERSION;
  scopeHash: string;
  kernelVersion: typeof EXACT_OPTIMIZER_KERNEL_VERSION;
  traceVersion: typeof EXACT_OPTIMIZER_TRACE_VERSION;
  coverage: readonly CoverageAxis[];
  gates: Readonly<{
    compression: Readonly<{
      authorized: boolean;
      mode: "trace-preserving-replay-only";
      reason: string;
      corpusCaseCount: number;
      traceFallbackCount: number;
      endpointMismatchCounts: Readonly<{ lower: number; central: number; upper: number }>;
      elapsedMilliseconds: number | null;
      reportHash: string | null;
      supplementalReducedCaseIds: readonly string[];
      supplementalParityMismatches: number;
    }>;
    rootBounds: Readonly<{
      authorized: boolean;
      classCount: number | null;
      singletonSafeClassCount: number | null;
      fullScopeChartCount: number | null;
      reportHash: string | null;
      rootPruning: Readonly<{ entrants: number; pruned: number; survivors: number }> | null;
      reason: string;
    }>;
    leaderEquivalence: Readonly<{
      authorized: boolean;
      classes: number;
      singletonFallback: boolean;
      multiplicityReconciled: boolean;
      caseCount: number;
      mismatchCount: number;
    }>;
    reducedBounds: Readonly<{
      verified: boolean;
      scope: "reduced-fixture-only";
      stages: readonly ["B0", "B1", "B2", "B3"];
      strictPruneOnly: boolean;
      caseIds: readonly string[];
    }>;
    parallel: Readonly<{
      authorized: boolean;
      workerCount: number;
      caseIds: readonly string[];
      serialDigest: string;
      parallelDigest: string;
    }>;
    coverageAuthorization: Readonly<{
      authorized: boolean;
      derivedFrom: readonly ["full-100000-trace-parity", "full-113-class-root-bounds"];
      reason: string;
    }>;
  }>;
  requiredZeroCoverage: readonly string[];
  ledgerHash: string;
  certificateEligible: false;
}>;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

type FullTraceParityEvidence = Readonly<{
  authorized: boolean;
  corpusCaseCount: number;
  traceFallbackCount: number;
  endpointMismatchCounts: Readonly<{ lower: number; central: number; upper: number }>;
  elapsedMilliseconds: number | null;
  reportHash: string | null;
  reason: string;
}>;

type FullRootBoundEvidence = Readonly<{
  authorized: boolean;
  classCount: number | null;
  singletonSafeClassCount: number | null;
  chartCount: number | null;
  reportHash: string | null;
  rootPruning: Readonly<{ entrants: number; pruned: number; survivors: number }> | null;
  reason: string;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function artifactFile(name: string): string {
  return fileURLToPath(new URL(`../../../data/native/${name}`, import.meta.url));
}

function readArtifact(name: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(readFileSync(artifactFile(name), "utf8")) as unknown);
  } catch {
    return null;
  }
}

function readFullTraceParityEvidence(): FullTraceParityEvidence {
  const artifact = readArtifact("exact-optimizer-compiled-parity-v1.json");
  if (!artifact) {
    return {
      authorized: false,
      corpusCaseCount: 0,
      traceFallbackCount: 0,
      endpointMismatchCounts: { lower: 0, central: 0, upper: 0 },
      elapsedMilliseconds: null,
      reportHash: null,
      reason: "The 100000-case trace parity artifact is unavailable.",
    };
  }
  const summary = asRecord(artifact.tracePreservingParity) as ExactOptimizerTraceParitySummary | null;
  const reportHash = typeof artifact.reportHash === "string" ? artifact.reportHash : null;
  const { reportHash: _reportedHash, ...withoutHash } = artifact;
  const hashValid = reportHash !== null && reportHash === sha256(withoutHash);
  const endpointMismatchCounts = asRecord(summary?.compressedVsUncompressed?.endpointMismatchCounts);
  const lower = finiteNumber(endpointMismatchCounts?.lower) ?? 0;
  const central = finiteNumber(endpointMismatchCounts?.central) ?? 0;
  const upper = finiteNumber(endpointMismatchCounts?.upper) ?? 0;
  try {
    const authorized =
      artifact.scopeHash === exactOptimizerScope.scopeHash &&
      artifact.sampleCount === 100_000 &&
      hashValid &&
      summary !== null &&
      isFullExactOptimizerTraceParity(summary, 100_000);
    return {
      authorized,
      corpusCaseCount: finiteNumber(summary?.sampleCount) ?? 0,
      traceFallbackCount: finiteNumber(summary?.traceFallbackCount) ?? 0,
      endpointMismatchCounts: { lower, central, upper },
      elapsedMilliseconds: finiteNumber(summary?.elapsedMilliseconds),
      reportHash,
      reason: authorized
        ? "The current 100000-case trace-preserving versus forced-uncompressed lower/central/upper corpus passed with a content-valid report."
        : "The trace parity artifact is stale, malformed, incomplete, fell back, or diverged.",
    };
  } catch {
    return {
      authorized: false,
      corpusCaseCount: finiteNumber(summary?.sampleCount) ?? 0,
      traceFallbackCount: finiteNumber(summary?.traceFallbackCount) ?? 0,
      endpointMismatchCounts: { lower, central, upper },
      elapsedMilliseconds: finiteNumber(summary?.elapsedMilliseconds),
      reportHash,
      reason: "The trace parity artifact could not be validated.",
    };
  }
}

function readFullRootBoundEvidence(expectedClassCount: number): FullRootBoundEvidence {
  const artifact = readArtifact("exact-optimizer-leader-root-bounds-v1.json");
  if (!artifact) {
    return {
      authorized: false,
      classCount: null,
      singletonSafeClassCount: null,
      chartCount: null,
      reportHash: null,
      rootPruning: null,
      reason: "The full fixed-Leader root-bound artifact is unavailable.",
    };
  }
  const scope = asRecord(artifact.scope);
  const classes = asRecord(artifact.leaderClasses);
  const rootPruning = asRecord(artifact.rootPruning);
  const records = Array.isArray(artifact.fixedLeaderRecords) ? artifact.fixedLeaderRecords : [];
  const parsedPruning =
    finiteNumber(rootPruning?.entrants) !== null &&
    finiteNumber(rootPruning?.pruned) !== null &&
    finiteNumber(rootPruning?.survivors) !== null
      ? {
          entrants: finiteNumber(rootPruning?.entrants)!,
          pruned: finiteNumber(rootPruning?.pruned)!,
          survivors: finiteNumber(rootPruning?.survivors)!,
        }
      : null;
  const coverageGate = asRecord(artifact.coverageGate);
  const reportHash = typeof artifact.reportHash === "string" ? artifact.reportHash : null;
  const { reportHash: _reportedHash, ...withoutHash } = artifact;
  const hashValid = reportHash !== null && reportHash === sha256(withoutHash);
  const classCount = finiteNumber(classes?.classCount);
  const singletonSafeClassCount = finiteNumber(classes?.singletonSafeClassCount);
  const chartCount = finiteNumber(scope?.chartCount);
  const methodologyHash = typeof artifact.methodologyHash === "string" ? artifact.methodologyHash : null;
  const everyRecordIsWholeSingleton = records.every((entry) => {
    const record = asRecord(entry);
    return (
      record !== null &&
      finiteNumber(record.multiplicity) === 1 &&
      typeof record.representativeCardId === "string" &&
      typeof record.methodologyHash === "string" &&
      record.methodologyHash === methodologyHash &&
      finiteNumber(record.upperCentralMicroUnits) !== null &&
      finiteNumber(record.incumbentGapMicroUnits) !== null &&
      typeof record.prunedAtRoot === "boolean"
    );
  });
  const authorized =
    artifact.scopeHash === exactOptimizerScope.scopeHash &&
    artifact.kind === "exact-optimizer-leader-root-bounds-full-scope" &&
    scope?.memberCardCount === expectedClassCount &&
    scope?.leaderOutfitCount === expectedClassCount &&
    chartCount === 30 &&
    classCount === expectedClassCount &&
    singletonSafeClassCount === expectedClassCount &&
    classes?.allSingletonSafe === true &&
    records.length === expectedClassCount &&
    everyRecordIsWholeSingleton &&
    parsedPruning !== null &&
    parsedPruning.entrants === expectedClassCount &&
    parsedPruning.pruned + parsedPruning.survivors === expectedClassCount &&
    coverageGate?.authorized === true &&
    artifact.certificateEligible === false &&
    hashValid;
  return {
    authorized,
    classCount,
    singletonSafeClassCount,
    chartCount,
    reportHash,
    rootPruning: parsedPruning,
    reason: authorized
      ? "All current singleton-safe Leader classes have content-valid whole-Leader root bounds over the declared 113-Member/30-chart scope."
      : "The full fixed-Leader root-bound artifact is stale, malformed, incomplete, or not full scope.",
  };
}

function applicationRecords(): ApplicationRecord[] {
  const records: ApplicationRecord[] = [];
  for (const card of mechanicsData.cards) {
    const add = (
      source: ApplicationRecord["source"],
      level: number | null,
      applications: readonly Application[],
    ): void => {
      applications.forEach((application, index) => {
        records.push({
          recordId: `${card.cardId}:${source}:${level ?? "root"}:${index}`,
          cardId: card.cardId,
          source,
          level,
          application,
        });
      });
    };
    add("leader", null, card.leaderOutfit.applications);
    card.skills.active.forEach((skill) => add("active", skill.level, skill.applications));
    card.skills.passive.forEach((skill) => add("passive", skill.level, skill.applications));
    card.skills.special.forEach((skill) => add("special", skill.level, skill.applications));
  }
  return records;
}

function axis(
  id: string,
  records: readonly ApplicationRecord[],
  keyFor: (record: ApplicationRecord) => string | null,
  execution: CoverageExecution,
  requiredKeys: readonly string[] = [],
): CoverageAxis {
  const recordIdsByKey = new Map<string, string[]>();
  const caseIdsByKey = new Map<string, string[]>();
  for (const key of requiredKeys) {
    recordIdsByKey.set(key, []);
    caseIdsByKey.set(key, []);
  }
  for (const record of records) {
    const key = keyFor(record);
    if (key === null) continue;
    const ids = recordIdsByKey.get(key) ?? [];
    ids.push(record.recordId);
    recordIdsByKey.set(key, ids);
    const caseIds = caseIdsByKey.get(key) ?? [];
    caseIds.push(...(execution.applicationCaseIdsByRecordId.get(record.recordId) ?? []));
    caseIdsByKey.set(key, caseIds);
  }
  return {
    id,
    entries: [...recordIdsByKey.entries()]
      .map(([key, recordIds]) => ({
        key,
        count: caseIdsByKey.get(key)?.length ?? 0,
        recordIds: Object.freeze([...recordIds].sort((left, right) => left.localeCompare(right))),
        caseIds: Object.freeze(
          [...(caseIdsByKey.get(key) ?? [])].sort((left, right) => left.localeCompare(right)),
        ),
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function staticAxis(
  id: string,
  entries: Readonly<Record<string, readonly string[]>>,
): CoverageAxis {
  return {
    id,
    entries: Object.entries(entries)
      .map(([key, caseIds]) => ({
        key,
        count: caseIds.length,
        recordIds: Object.freeze([]),
        caseIds: Object.freeze([...caseIds].sort((left, right) => left.localeCompare(right))),
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function requiredZeroCoverage(coverage: readonly CoverageAxis[]): string[] {
  return coverage.flatMap((coverageAxis) =>
    coverageAxis.entries
      .filter((entry) => entry.count === 0)
      .map((entry) => `${coverageAxis.id}:${entry.key}`),
  );
}

function normalizedGroup(value: string): string {
  return value.toLowerCase().replace(/^grp-/, "").replace(/[^a-z0-9]/g, "");
}

function fixtureFormation(record: ApplicationRecord): LegalFormation {
  const publicById = new Map(publicCards.map((card) => [card.id, card]));
  const preferred = [record.cardId];
  const target = record.application.target;
  if (target?.kind === "attribute" && target.attribute) {
    preferred.push(
      ...publicCards
        .filter((card) => card.attribute === target.attribute)
        .map((card) => card.id),
    );
  }
  if (target?.kind === "character-group" && target.characterGroupingId) {
    const expected = normalizedGroup(target.characterGroupingId);
    preferred.push(
      ...publicCards
        .filter((card) => card.groups.some((group) => normalizedGroup(group) === expected))
        .map((card) => card.id),
    );
  }
  preferred.push(...mechanicsData.cards.map((card) => card.cardId));
  const members: string[] = [];
  const talents = new Set<string>();
  for (const cardId of preferred) {
    const publicCard = publicById.get(cardId);
    const mechanics = mechanicsData.cards.find((card) => card.cardId === cardId);
    if (!publicCard || !mechanics || talents.has(mechanics.talentId)) continue;
    talents.add(mechanics.talentId);
    members.push(cardId);
    if (members.length === 5) break;
  }
  if (members.length !== 5) throw new Error(`Coverage fixture cannot form a legal team for ${record.recordId}`);
  return assertLegalFormation({
    leaderOutfitCardId: record.cardId,
    members: members.map((cardId) => ({ cardId, investment: "one-copy-maximum" as const })),
  });
}

function chartForSingerState(talentId: string, wantMatch: boolean) {
  const aggregateCharts = songContextData.charts.filter((chart) => chart.fidelity === "aggregate");
  const chart = aggregateCharts.find((candidate) => {
    const song = songContextData.songs.find((entry) => entry.id === candidate.songId)!;
    return song.singerTalentIds.includes(talentId) === wantMatch;
  });
  return chart ?? aggregateCharts[0]!;
}

function triggerObservation(chartKey: string): TriggerObservation {
  const chart = songContextData.charts.find((candidate) => candidate.key === chartKey)!;
  const song = songContextData.songs.find((candidate) => candidate.id === chart.songId)!;
  return {
    combo: chart.fullComboNoteCount,
    life: 1_000,
    judgement: "perfect",
    songSingerTalentIds: song.singerTalentIds,
  };
}

function branchThreshold(
  trigger: NonNullable<Application["trigger"]>,
  formation: LegalFormation,
): number {
  if (trigger.kind === "deck-attribute-count" || trigger.kind === "deck-character-group-count") {
    let maximumPassingThreshold = 0;
    for (let threshold = 0; threshold <= 5; threshold += 1) {
      if (evaluateTrigger({ ...trigger, threshold }, formation, triggerObservation("m0206:expert")) === true) {
        maximumPassingThreshold = threshold;
      }
    }
    return maximumPassingThreshold;
  }
  return trigger.threshold ?? 0;
}

const COMPRESSION_PARITY_MEMBERS = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
] as const;

const COMPRESSION_PARITY_LAYERS = [
  "low-investment",
  "one-copy-maximum",
  "duplicate-enabled-ceiling",
] as const;

/**
 * Execute independently cross-checked trace cases. The worker harness calls
 * this exact function in separate Node processes; it is not a synthetic
 * coverage inventory.
 */
export function executeExactOptimizerCoverageParitySlice(input: Readonly<{
  caseIndexes: readonly number[];
}>): CompressionParitySlice {
  const results: CompressionParityCaseResult[] = [];
  let mismatchCount = 0;
  for (const index of input.caseIndexes) {
    const investmentLayer = COMPRESSION_PARITY_LAYERS[index];
    if (!investmentLayer) throw new Error(`Unknown compression parity case index: ${index}`);
    const bloomStageByCardId = Object.fromEntries(
      COMPRESSION_PARITY_MEMBERS.map((cardId, memberIndex) => [
        cardId,
        ((index * 2 + memberIndex) % 6) as 0 | 1 | 2 | 3 | 4 | 5,
      ]),
    );
    const caseId = `compression:${investmentLayer}:bloom-${index}`;
    try {
      const team = compileExactOptimizerTeam({
        memberCardIds: COMPRESSION_PARITY_MEMBERS,
        investmentLayer,
        bloomStageByCardId,
      });
      const result = crossCheckExactOptimizerTeamLeader({
        team,
        leaderOutfitCardId: "card-00001-5-uniq-0000-00",
        chartKey: index === 1 ? "m0309:expert" : "m0206:expert",
        seed: 0x5eed,
        accountState: {
          board: {
            mode: "declared-neutral",
            evidenceGrade: "verified",
            evidenceRef: "coverage:compressed-parity",
          },
        },
      });
      if (result.execution.mode !== "trace-preserving-state-runs") {
        mismatchCount += 1;
        continue;
      }
      results.push({
        caseId,
        canonicalUtility: {
          lower: result.canonicalUtility.lower,
          central: result.canonicalUtility.central,
          upper: result.canonicalUtility.upper,
        },
        mode: result.execution.mode,
      });
    } catch {
      mismatchCount += 1;
    }
  }
  return { results: Object.freeze(results), mismatchCount };
}

function parityDigest(results: readonly CompressionParityCaseResult[]): string {
  return sha256([...results].sort((left, right) => left.caseId.localeCompare(right.caseId)));
}

function runCoverageWorker(caseIndexes: readonly number[]): Promise<CompressionParitySlice> {
  const workerPath = fileURLToPath(
    new URL("../../../scripts/run-exact-optimizer-coverage-worker.mjs", import.meta.url),
  );
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx/esm", workerPath, `--case-indexes=${caseIndexes.join(",")}`],
      { cwd: fileURLToPath(new URL("../../../", import.meta.url)), stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Exact coverage worker ${caseIndexes.join(",")} failed: ${stderr.trim()}`));
        return;
      }
      try {
        const output = JSON.parse(stdout) as CompressionParitySlice;
        resolve(output);
      } catch (error) {
        reject(new Error(`Exact coverage worker returned invalid JSON: ${String(error)}`));
      }
    });
  });
}

/**
 * Parallelism is only across independent candidate evaluations. Each worker
 * still uses the serial trace-preserving arithmetic kernel within a candidate.
 */
export async function runExactOptimizerParallelExecutionEvidence(): Promise<ExactOptimizerParallelExecutionEvidence> {
  const serial = executeExactOptimizerCoverageParitySlice({ caseIndexes: [0, 1, 2] });
  const workers = await Promise.all([
    runCoverageWorker([0, 2]),
    runCoverageWorker([1]),
  ]);
  const parallel = workers.flatMap((worker) => worker.results).sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );
  const serialResults = [...serial.results].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );
  const serialDigest = parityDigest(serialResults);
  const parallelDigest = parityDigest(parallel);
  return {
    kind: "exact-optimizer-independent-parallel-evidence",
    workerCount: workers.length,
    caseIds: Object.freeze(parallel.map((entry) => `parallel:${entry.caseId}`)),
    serialDigest,
    parallelDigest,
    matched:
      serial.mismatchCount === 0 &&
      workers.every((worker) => worker.mismatchCount === 0) &&
      serialDigest === parallelDigest &&
      serialResults.length === COMPRESSION_PARITY_LAYERS.length,
  };
}

/** Execute an application through the actual resolver and every observed trigger branch. */
function executeCoverageCases(
  records: readonly ApplicationRecord[],
  parallelEvidence: ExactOptimizerParallelExecutionEvidence,
): CoverageExecution {
  const applicationCaseIdsByRecordId = new Map<string, readonly string[]>();
  const branchCaseIdsByKey = new Map<string, string[]>();
  const hitBranch = (key: string, caseId: string): void => {
    const caseIds = branchCaseIdsByKey.get(key) ?? [];
    caseIds.push(caseId);
    branchCaseIdsByKey.set(key, caseIds);
  };
  const hitApplication = (recordId: string, caseId: string): void => {
    const caseIds = applicationCaseIdsByRecordId.get(recordId) ?? [];
    applicationCaseIdsByRecordId.set(recordId, [...caseIds, caseId]);
  };

  for (const record of records) {
    const formation = fixtureFormation(record);
    const mechanics = mechanicsData.cards.find((card) => card.cardId === record.cardId)!;
    const chart = chartForSingerState(mechanics.talentId, true);
    const observation = triggerObservation(chart.key);
    const applicationCaseId = `application:${record.recordId}:singer-${observation.songSingerTalentIds?.includes(mechanics.talentId) ? "match" : "mismatch"}`;
    if (record.source === "leader") {
      resolveLeaderApplications([record.application], formation, observation);
    } else {
      resolveActiveApplications([record.application], formation, observation);
    }
    hitApplication(record.recordId, applicationCaseId);
    hitBranch(
      observation.songSingerTalentIds?.includes(mechanics.talentId) ? "singer:match" : "singer:mismatch",
      applicationCaseId,
    );
    const mismatchChart = chartForSingerState(mechanics.talentId, false);
    const mismatchObservation = triggerObservation(mismatchChart.key);
    if (!mismatchObservation.songSingerTalentIds?.includes(mechanics.talentId)) {
      const mismatchCaseId = `application:${record.recordId}:singer-mismatch`;
      if (record.source === "leader") {
        resolveLeaderApplications([record.application], formation, mismatchObservation);
      } else {
        resolveActiveApplications([record.application], formation, mismatchObservation);
      }
      hitApplication(record.recordId, mismatchCaseId);
      hitBranch("singer:mismatch", mismatchCaseId);
    }
    if (record.application.target) {
      const targetCaseId = `target:${record.recordId}`;
      const recipients = resolveTargetRecipients(record.application.target, formation.members, 0);
      hitApplication(record.recordId, targetCaseId);
      hitBranch(`target:${record.application.target.kind}`, targetCaseId);
      if (record.application.target.count !== null) {
        hitBranch(`cap-${record.application.target.count}`, targetCaseId);
      }
      hitBranch(
        recipients.status === "resolved" ? "recipient:exact" : "recipient:unresolved",
        targetCaseId,
      );
    }
    const trigger = record.application.trigger;
    if (!trigger) continue;
    const boundary = branchThreshold(trigger, formation);
    const baseObservation = triggerObservation("m0206:expert");
    for (const branch of ["passing", "failing", "boundary"] as const) {
      let mutated = trigger;
      let observation = baseObservation;
      if (trigger.kind === "combo-at-least") {
        observation = {
          ...baseObservation,
          combo: branch === "failing" ? boundary - 1 : boundary,
        };
      } else if (trigger.kind === "life-at-least") {
        observation = {
          ...baseObservation,
          life: branch === "failing" ? boundary - 1 : boundary,
        };
      } else if (trigger.kind === "life-at-most") {
        observation = {
          ...baseObservation,
          life: branch === "failing" ? boundary + 1 : boundary,
        };
      } else if (
        trigger.kind === "deck-attribute-count" ||
        trigger.kind === "deck-character-group-count"
      ) {
        mutated = { ...trigger, threshold: branch === "failing" ? boundary + 1 : boundary };
      }
      const value = evaluateTrigger(
        mutated,
        formation,
        observation,
      );
      const expected = branch === "failing" ? false : true;
      if (value === expected) {
        const caseId = `trigger:${record.recordId}:${branch}`;
        hitApplication(record.recordId, caseId);
        hitBranch(`trigger:${trigger.kind}:${branch}`, caseId);
      }
    }
  }

  const compression = executeExactOptimizerCoverageParitySlice({ caseIndexes: [0, 1, 2] });
  const compressionCaseIds = compression.results.map((entry) => entry.caseId);
  for (const result of compression.results) {
    const index = Number(result.caseId.match(/bloom-(\d+)$/)?.[1]);
    const investmentLayer = COMPRESSION_PARITY_LAYERS[index]!;
    hitBranch(`investment:${investmentLayer}`, result.caseId);
    for (const memberIndex of COMPRESSION_PARITY_MEMBERS.keys()) {
      hitBranch(`bloom:${(index * 2 + memberIndex) % 6}`, result.caseId);
    }
    hitBranch("execution:serial", result.caseId);
  }

  const legalBoundaryCaseIds: string[] = [];
  const legalFormation = assertLegalFormation({
    leaderOutfitCardId: "card-00001-5-uniq-0000-00",
    members: COMPRESSION_PARITY_MEMBERS.map((cardId) => ({
      cardId,
      investment: "one-copy-maximum" as const,
    })),
  });
  if (legalFormation.members.length === 5) {
    legalBoundaryCaseIds.push("legal:five-members", "legal:one-member-per-talent");
  }
  const byTalent = new Map<string, string[]>();
  for (const card of mechanicsData.cards) {
    const cardIds = byTalent.get(card.talentId) ?? [];
    cardIds.push(card.cardId);
    byTalent.set(card.talentId, cardIds);
  }
  const duplicateTalentCards = [...byTalent.values()].find((cardIds) => cardIds.length >= 2);
  if (!duplicateTalentCards) throw new Error("Coverage catalog has no duplicate-talent collision case");
  const collisionMembers = [...duplicateTalentCards.slice(0, 2)];
  const collisionTalent = mechanicsData.cards.find((card) => card.cardId === collisionMembers[0])!.talentId;
  for (const card of mechanicsData.cards) {
    if (collisionMembers.length === 5) break;
    if (card.talentId === collisionTalent) continue;
    if (collisionMembers.some((cardId) => mechanicsData.cards.find((candidate) => candidate.cardId === cardId)!.talentId === card.talentId)) continue;
    collisionMembers.push(card.cardId);
  }
  try {
    assertLegalFormation({
      leaderOutfitCardId: "card-00001-5-uniq-0000-00",
      members: collisionMembers.map((cardId) => ({
        cardId,
        investment: "one-copy-maximum" as const,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique talents")) {
      legalBoundaryCaseIds.push("legal:same-talent-rejected");
    }
  }
  const allMemberCardIds = mechanicsData.cards.map((card) => card.cardId);
  if (countNativeLegalTeamSets({ eligibleMemberCardIds: allMemberCardIds, maxFiveStarMembers: 0 }) > 0) {
    legalBoundaryCaseIds.push("legal:five-star-cap-zero");
  }
  if (countNativeLegalTeamSets({ eligibleMemberCardIds: allMemberCardIds, maxFiveStarMembers: 5 }) > 0) {
    legalBoundaryCaseIds.push("legal:five-star-cap-five");
  }

  const roundingBoundaryCaseIds: string[] = [];
  if (toCanonicalMicroUnits(0.0000005) === 1) {
    roundingBoundaryCaseIds.push("round:js-positive-half-micro");
  }
  if (toCanonicalMicroUnits(-0.0000005) === 0) {
    roundingBoundaryCaseIds.push("round:js-negative-half-micro");
  }
  const tied = {
    lower: toCanonicalMicroUnits(1),
    central: toCanonicalMicroUnits(2),
    upper: toCanonicalMicroUnits(3),
  };
  if (canonicalUtilityTie(tied, { ...tied })) {
    roundingBoundaryCaseIds.push("round:canonical-central-tie");
  }
  if (!canPruneByStrictCentralUpperBound(tied.central, tied.central)) {
    roundingBoundaryCaseIds.push("round:strict-upper-equality-survives");
  }

  const eligibleMemberCardIds = [...COMPRESSION_PARITY_MEMBERS, "card-00018-5-uniq-0004-00"];
  const eligibleLeaderOutfitCardIds = [
    "card-00001-5-uniq-0000-00",
    "card-00013-5-uniq-0002-00",
  ];
  const boundCaseIds: string[] = [];
  let boundsAuthorized = false;
  try {
    const root = compileNativeLeaderRootBounds({
      partialMemberCardIds: [],
      eligibleMemberCardIds,
      eligibleLeaderOutfitCardIds,
      investmentLayer: "one-copy-maximum",
      chartKeys: ["m0206:expert"],
    });
    const b2 = compileNativeLeaderRootBounds({
      partialMemberCardIds: [eligibleMemberCardIds[0]!],
      eligibleMemberCardIds,
      eligibleLeaderOutfitCardIds,
      investmentLayer: "one-copy-maximum",
      chartKeys: ["m0206:expert"],
    });
    const b3 = searchNativeGlobalTeams({
      eligibleMemberCardIds,
      eligibleLeaderOutfitCardIds,
      investmentLayer: "one-copy-maximum",
      chartKeys: ["m0206:expert"],
      seed: 0x5eed,
      accountState: {
        board: {
          mode: "declared-neutral",
          evidenceGrade: "verified",
          evidenceRef: "coverage:bounds",
        },
      },
    });
    if (root.b1.length > 0 && b2.b1.length > 0 && b3.certificate.countsReconciled) {
      boundCaseIds.push("bounds:B0", "bounds:B1", "bounds:B2", "bounds:B3");
      boundsAuthorized = true;
    }
  } catch {
    boundsAuthorized = false;
  }
  const leaderProof = proveNativeLeaderEquivalenceCoverage({
    eligibleLeaderOutfitCardIds: mechanicsData.cards.map((card) => card.cardId),
    seed: 0x5eed,
    accountState: {
      board: {
        mode: "declared-neutral",
        evidenceGrade: "verified",
        evidenceRef: "coverage:leader-equivalence",
      },
    },
  });
  return {
    applicationCaseIdsByRecordId,
    branchCaseIdsByKey,
    compressionCaseIds: Object.freeze(compressionCaseIds),
    compressionParityMismatches: compression.mismatchCount,
    legalBoundaryCaseIds: Object.freeze(legalBoundaryCaseIds),
    roundingBoundaryCaseIds: Object.freeze(roundingBoundaryCaseIds),
    parallelCaseIds: parallelEvidence.matched
      ? Object.freeze([...parallelEvidence.caseIds])
      : Object.freeze([]),
    leaderProof,
    boundCaseIds: Object.freeze(boundCaseIds),
    boundsAuthorized,
  };
}

/**
 * Build a ledger from actual catalog records and explicit proof-path facts.
 * Axes are independent inventories, not a fictitious Cartesian product.
 */
export async function buildExactOptimizerCoverageLedger(): Promise<ExactOptimizerCoverageLedger> {
  const records = applicationRecords();
  const cardIds = mechanicsData.cards.map((card) => card.cardId).sort((left, right) =>
    left.localeCompare(right),
  );
  const parallelEvidence = await runExactOptimizerParallelExecutionEvidence();
  const execution = executeCoverageCases(records, parallelEvidence);
  const leaderEquivalence = compileNativeLeaderEquivalence({
    eligibleLeaderOutfitCardIds: cardIds,
  });
  const fullTraceParity = readFullTraceParityEvidence();
  const fullRootBounds = readFullRootBoundEvidence(cardIds.length);
  const caseIdsFor = (predicate: (record: ApplicationRecord) => boolean): readonly string[] =>
    records
      .filter(predicate)
      .flatMap((record) => execution.applicationCaseIdsByRecordId.get(record.recordId) ?? [])
      .sort((left, right) => left.localeCompare(right));
  const branchCaseIds = (key: string): readonly string[] =>
    execution.branchCaseIdsByKey.get(key) ?? [];
  const cardCaseIds = (cardId: string): readonly string[] => caseIdsFor((record) => record.cardId === cardId);

  const coverage: CoverageAxis[] = [
    staticAxis(
      "member-cards",
      Object.fromEntries(cardIds.map((cardId) => [cardId, cardCaseIds(cardId)])),
    ),
    staticAxis(
      "leader-sources",
      Object.fromEntries(cardIds.map((cardId) => [cardId, cardCaseIds(cardId)])),
    ),
    axis("application-records", records, (record) => record.recordId, execution),
    axis("effect-records", records, (record) =>
      record.application.effect ? record.recordId : null, execution,
    ),
    axis(
      "effect-families",
      records,
      (record) => record.application.effect?.family ?? null,
      execution,
      ["active", "passive"],
    ),
    axis(
      "effect-kinds",
      records,
      (record) => record.application.effect?.kind ?? null,
      execution,
    ),
    axis(
      "combinations",
      records,
      (record) => record.application.combination,
      execution,
      ["additive", "conditional-base", "conditional-additive", "conditional-override"],
    ),
    axis(
      "trigger-kinds",
      records,
      (record) => record.application.trigger?.kind ?? null,
      execution,
      ["combo-at-least", "deck-attribute-count", "deck-character-group-count", "life-at-least"],
    ),
    axis("target-kinds", records, (record) => record.application.target?.kind ?? null, execution, [
      "all",
      "self",
      "attribute",
      "character-group",
    ]),
    axis("target-caps", records, (record) => {
      const target = record.application.target;
      return target && target.count !== null ? `cap-${target.count}` : null;
    }, execution, ["cap-2", "cap-3"]),
    axis("recipient-resolution", records, (record) => {
      const target = record.application.target;
      if (!target) return null;
      const caseIds = execution.applicationCaseIdsByRecordId.get(record.recordId) ?? [];
      return caseIds.some((caseId) => caseId.startsWith("target:")) &&
        branchCaseIds("recipient:unresolved").some((caseId) => caseIds.includes(caseId))
        ? "unresolved"
        : "exact";
    }, execution, ["exact", "unresolved"]),
    staticAxis("trigger-boundaries", Object.fromEntries(
      ["combo-at-least", "deck-attribute-count", "deck-character-group-count", "life-at-least"]
        .flatMap((kind) => ["passing", "failing", "boundary"].map((state) => [
          `${kind}:${state}`,
          branchCaseIds(`trigger:${kind}:${state}`),
        ])),
    )),
    staticAxis("member-leader-same-talent-collisions", {
      "same-talent-collision": caseIdsFor((record) => record.source !== "leader"),
    }),
    staticAxis("singer-states", {
      match: branchCaseIds("singer:match"),
      mismatch: branchCaseIds("singer:mismatch"),
    }),
    staticAxis("investment-layers", {
      "low-investment": branchCaseIds("investment:low-investment"),
      "one-copy-maximum": branchCaseIds("investment:one-copy-maximum"),
      "duplicate-enabled-ceiling": branchCaseIds("investment:duplicate-enabled-ceiling"),
    }),
    staticAxis("bloom-stages", Object.fromEntries(
      Array.from({ length: 6 }, (_, stage) => [`bloom-${stage}`, branchCaseIds(`bloom:${stage}`)]),
    )),
    staticAxis("rarity-and-legal-boundaries", {
      "rarity-4": caseIdsFor((record) => mechanicsData.cards.find((card) => card.cardId === record.cardId)!.rarity === 4),
      "rarity-5": caseIdsFor((record) => mechanicsData.cards.find((card) => card.cardId === record.cardId)!.rarity === 5),
      "five-members": execution.legalBoundaryCaseIds.filter((caseId) => caseId === "legal:five-members"),
      "one-member-per-talent": execution.legalBoundaryCaseIds.filter((caseId) => caseId === "legal:one-member-per-talent"),
      "same-talent-rejected": execution.legalBoundaryCaseIds.filter((caseId) => caseId === "legal:same-talent-rejected"),
      "five-star-cap-zero": execution.legalBoundaryCaseIds.filter((caseId) => caseId === "legal:five-star-cap-zero"),
      "five-star-cap-five": execution.legalBoundaryCaseIds.filter((caseId) => caseId === "legal:five-star-cap-five"),
    }),
    staticAxis("rounding-and-tie-boundaries", {
      "js-round-positive-half-micro": execution.roundingBoundaryCaseIds.filter((caseId) => caseId === "round:js-positive-half-micro"),
      "js-round-negative-half-micro": execution.roundingBoundaryCaseIds.filter((caseId) => caseId === "round:js-negative-half-micro"),
      "canonical-central-tie": execution.roundingBoundaryCaseIds.filter((caseId) => caseId === "round:canonical-central-tie"),
      "strict-upper-equality-survives": execution.roundingBoundaryCaseIds.filter((caseId) => caseId === "round:strict-upper-equality-survives"),
    }),
    staticAxis("execution-paths", {
      serial: branchCaseIds("execution:serial"),
      parallel: execution.parallelCaseIds,
    }),
  ];
  const zeros = requiredZeroCoverage(coverage);
  const coverageAuthorized = fullTraceParity.authorized && fullRootBounds.authorized;
  const withoutHash = {
    schemaVersion: 1 as const,
    kind: "exact-optimizer-coverage" as const,
    methodologyVersion: EXACT_OPTIMIZER_COVERAGE_VERSION,
    scopeHash: exactOptimizerScope.scopeHash,
    kernelVersion: EXACT_OPTIMIZER_KERNEL_VERSION,
    traceVersion: EXACT_OPTIMIZER_TRACE_VERSION,
    coverage,
    gates: {
      compression: {
        authorized: fullTraceParity.authorized,
        mode: "trace-preserving-replay-only" as const,
        reason: fullTraceParity.reason,
        corpusCaseCount: fullTraceParity.corpusCaseCount,
        traceFallbackCount: fullTraceParity.traceFallbackCount,
        endpointMismatchCounts: fullTraceParity.endpointMismatchCounts,
        elapsedMilliseconds: fullTraceParity.elapsedMilliseconds,
        reportHash: fullTraceParity.reportHash,
        supplementalReducedCaseIds: execution.compressionCaseIds,
        supplementalParityMismatches: execution.compressionParityMismatches,
      },
      rootBounds: {
        authorized: fullRootBounds.authorized,
        classCount: fullRootBounds.classCount,
        singletonSafeClassCount: fullRootBounds.singletonSafeClassCount,
        fullScopeChartCount: fullRootBounds.chartCount,
        reportHash: fullRootBounds.reportHash,
        rootPruning: fullRootBounds.rootPruning,
        reason: fullRootBounds.reason,
      },
      leaderEquivalence: {
        authorized:
          execution.leaderProof.mismatchCount === 0 &&
          (execution.leaderProof.singletonFallback || execution.leaderProof.comparedOutfitPairs > 0),
        classes: leaderEquivalence.classes.length,
        singletonFallback: execution.leaderProof.singletonFallback,
        multiplicityReconciled:
          execution.leaderProof.singletonFallback || execution.leaderProof.comparedOutfitPairs > 0,
        caseCount: execution.leaderProof.caseCount,
        mismatchCount: execution.leaderProof.mismatchCount,
      },
      reducedBounds: {
        verified: execution.boundsAuthorized,
        scope: "reduced-fixture-only" as const,
        stages: ["B0", "B1", "B2", "B3"] as const,
        strictPruneOnly: execution.boundsAuthorized,
        caseIds: execution.boundCaseIds,
      },
      parallel: {
        authorized:
          parallelEvidence.matched &&
          parallelEvidence.workerCount >= 2 &&
          parallelEvidence.caseIds.length === COMPRESSION_PARITY_LAYERS.length,
        workerCount: parallelEvidence.workerCount,
        caseIds: parallelEvidence.caseIds,
        serialDigest: parallelEvidence.serialDigest,
        parallelDigest: parallelEvidence.parallelDigest,
      },
      coverageAuthorization: {
        authorized: coverageAuthorized,
        derivedFrom: ["full-100000-trace-parity", "full-113-class-root-bounds"] as const,
        reason: coverageAuthorized
          ? "Coverage authorization derives from current full trace parity and current full fixed-Leader root-bound evidence; reduced B0/B1/B2/B3 remains a separate regression fixture."
          : "Coverage authorization is blocked until both the full 100000-case trace-parity and full 113-class root-bound artifacts validate.",
      },
    },
    requiredZeroCoverage: Object.freeze(zeros),
    certificateEligible: false as const,
  };
  return { ...withoutHash, ledgerHash: sha256(withoutHash) };
}

export function validateExactOptimizerCoverageLedger(
  ledger: ExactOptimizerCoverageLedger,
): void {
  if (ledger.schemaVersion !== 1 || ledger.kind !== "exact-optimizer-coverage") {
    throw new Error("Exact optimizer coverage ledger schema is invalid");
  }
  if (ledger.scopeHash !== exactOptimizerScope.scopeHash) {
    throw new Error("Exact optimizer coverage ledger scope hash is stale");
  }
  if (ledger.requiredZeroCoverage.length > 0) {
    throw new Error(`Exact optimizer required coverage is zero: ${ledger.requiredZeroCoverage.join(", ")}`);
  }
  const { ledgerHash, ...withoutHash } = ledger;
  if (sha256(withoutHash) !== ledgerHash) {
    throw new Error("Exact optimizer coverage ledger hash does not match its content");
  }
  if (
    !ledger.gates.compression.authorized ||
    !ledger.gates.rootBounds.authorized ||
    !ledger.gates.leaderEquivalence.authorized ||
    !ledger.gates.reducedBounds.verified ||
    !ledger.gates.parallel.authorized ||
    !ledger.gates.coverageAuthorization.authorized
  ) {
    throw new Error("An exact optimizer authorization gate is not satisfied");
  }
}
