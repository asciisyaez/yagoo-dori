import { type BloomStage, type FormationMember, type InvestmentLayer } from "./formation-evaluator";
import {
  toCanonicalMicroUnits,
  type CanonicalUtilityTuple,
} from "./exact-optimizer-arithmetic";
import {
  compileExactArithmeticTrace,
  type ExactArithmeticTrace,
  type ExactCompressionAdmissibility,
} from "./exact-optimizer-trace";
import {
  compileNativeUtilityTeamIntrinsic,
  evaluateNativeRelativeUtilityUncompressed,
  evaluateNativeRelativeUtilityWithCompiledTeam,
  type NativeUtilityInput,
  type NativeActiveTraceExecution,
  type NeutralBoardAccountState,
  type NativeUtilityTeamIntrinsic,
  type UtilityInterval,
} from "./native-utility";
import { songContextData } from "./song-contexts";

/**
 * This version names the trace-preserving compiled path. The TypeScript
 * evaluator remains the semantic authority and its uncompressed path is used
 * as an exact cross-check or a narrowly declared unsupported-mechanic fallback.
 */
export const EXACT_OPTIMIZER_KERNEL_VERSION = "yd-exact-trace-kernel-1.0.0" as const;

export type ExactOptimizerTeam = Readonly<{
  kind: "exact-optimizer-compiled-team";
  methodologyVersion: typeof EXACT_OPTIMIZER_KERNEL_VERSION;
  memberCardIds: readonly [string, string, string, string, string];
  /** Reused by every Leader evaluation; it contains no Leader-derived state. */
  members: readonly FormationMember[];
  investmentLayer: InvestmentLayer;
  bloomStageByCardId: Readonly<Record<string, BloomStage>>;
  nativeTeamIntrinsic: NativeUtilityTeamIntrinsic;
}>;

export type ExactOptimizerKernelEvaluation = Readonly<{
  kind: "exact-optimizer-kernel-evaluation";
  methodologyVersion: typeof EXACT_OPTIMIZER_KERNEL_VERSION;
  leaderOutfitCardId: string;
  chartKey: string;
  execution: Readonly<{
    mode: "uncompressed-reference" | "trace-preserving-state-runs";
    admissibility: ExactCompressionAdmissibility;
    trace: ExactArithmeticTrace;
    activeTrace: NativeActiveTraceExecution;
  }>;
  relativeUtility: UtilityInterval;
  canonicalUtility: CanonicalUtilityTuple;
}>;

const traceByChartKey = new Map<string, ExactArithmeticTrace>();

function traceForChart(chartKey: string): ExactArithmeticTrace {
  const cached = traceByChartKey.get(chartKey);
  if (cached) return cached;
  const chart = songContextData.charts.find((candidate) => candidate.key === chartKey);
  if (!chart || chart.fidelity !== "aggregate") {
    throw new Error(`Exact trace kernel requires an aggregate chart: ${chartKey}`);
  }
  const trace = compileExactArithmeticTrace(chart.fullComboNoteCount);
  traceByChartKey.set(chartKey, trace);
  return trace;
}

function sortedTeam(memberCardIds: readonly string[]): [string, string, string, string, string] {
  if (memberCardIds.length !== 5) {
    throw new Error(`Exact optimizer team requires five Members; received ${memberCardIds.length}`);
  }
  const sorted = [...memberCardIds].sort((left, right) => left.localeCompare(right));
  if (new Set(sorted).size !== sorted.length) {
    throw new Error("Exact optimizer team Members must be unique");
  }
  return sorted as [string, string, string, string, string];
}

/**
 * Compile only team-intrinsic data.  Formation legality and all Leader effects
 * remain checked by the native evaluator for each Leader, so this cache cannot
 * accidentally carry an effect from one Outfit into another.
 */
export function compileExactOptimizerTeam(input: Readonly<{
  memberCardIds: readonly string[];
  investmentLayer: InvestmentLayer;
  bloomStageByCardId?: Readonly<Record<string, BloomStage>>;
}>): ExactOptimizerTeam {
  const memberCardIds = sortedTeam(input.memberCardIds);
  const bloomStageByCardId: Record<string, BloomStage> = {};
  for (const cardId of memberCardIds) {
    const stage = input.bloomStageByCardId?.[cardId];
    if (stage !== undefined) bloomStageByCardId[cardId] = stage;
  }
  const members = Object.freeze(
    memberCardIds.map((cardId) => {
      const bloomStage = bloomStageByCardId[cardId];
      return bloomStage === undefined
        ? { cardId, investment: input.investmentLayer }
        : { cardId, investment: input.investmentLayer, bloomStage };
    }),
  );
  return Object.freeze({
    kind: "exact-optimizer-compiled-team",
    methodologyVersion: EXACT_OPTIMIZER_KERNEL_VERSION,
    memberCardIds: Object.freeze(memberCardIds),
    members,
    investmentLayer: input.investmentLayer,
    bloomStageByCardId: Object.freeze(bloomStageByCardId),
    nativeTeamIntrinsic: compileNativeUtilityTeamIntrinsic(members),
  });
}

function traceAdmissibility(
  trace: ExactArithmeticTrace,
  mode: "trace-preserving-state-runs" | "uncompressed-fallback",
  fallbackReason: string | null,
): ExactCompressionAdmissibility {
  return {
    kind: "exact-compression-admissibility",
    methodologyVersion: trace.methodologyVersion,
    admissible: mode === "trace-preserving-state-runs",
    mode,
    reasons: Object.freeze(fallbackReason ? [fallbackReason] : []),
  };
}

/**
 * Evaluate one fixed Leader against a compiled team.  The returned Members
 * array is reused by all Leader calls.  Unsupported compression deliberately
 * falls back before evaluation; no approximate or reassociated path exists.
 */
export function evaluateExactOptimizerTeamLeader(input: Readonly<{
  team: ExactOptimizerTeam;
  leaderOutfitCardId: string;
  chartKey: string;
  seed: number;
  accountState: NeutralBoardAccountState;
}>): ExactOptimizerKernelEvaluation {
  const trace = traceForChart(input.chartKey);
  const utilityInput: NativeUtilityInput = {
    formation: {
      leaderOutfitCardId: input.leaderOutfitCardId,
      members: input.team.members,
    },
    chartKey: input.chartKey,
    seed: input.seed,
    accountState: input.accountState,
  };
  const evaluation = evaluateNativeRelativeUtilityWithCompiledTeam(
    utilityInput,
    input.team.nativeTeamIntrinsic,
  );
  const relativeUtility = evaluation.result.relativeUtility;
  const admissibility = traceAdmissibility(
    trace,
    evaluation.activeTrace.mode,
    evaluation.activeTrace.fallbackReason,
  );
  return {
    kind: "exact-optimizer-kernel-evaluation",
    methodologyVersion: EXACT_OPTIMIZER_KERNEL_VERSION,
    leaderOutfitCardId: input.leaderOutfitCardId,
    chartKey: input.chartKey,
    execution: {
      mode: evaluation.activeTrace.mode === "trace-preserving-state-runs"
        ? "trace-preserving-state-runs"
        : "uncompressed-reference",
      admissibility,
      trace,
      activeTrace: evaluation.activeTrace,
    },
    relativeUtility,
    canonicalUtility: {
      lower: toCanonicalMicroUnits(relativeUtility.lower),
      central: toCanonicalMicroUnits(relativeUtility.central),
      upper: toCanonicalMicroUnits(relativeUtility.upper),
    },
  };
}

/** Exact micro-unit cross-check used by proof and pilot harnesses. */
export function crossCheckExactOptimizerTeamLeader(input: Readonly<{
  team: ExactOptimizerTeam;
  leaderOutfitCardId: string;
  chartKey: string;
  seed: number;
  accountState: NeutralBoardAccountState;
}>): ExactOptimizerKernelEvaluation {
  const kernel = evaluateExactOptimizerTeamLeader(input);
  const reference = evaluateNativeRelativeUtilityUncompressed({
    formation: { leaderOutfitCardId: input.leaderOutfitCardId, members: input.team.members },
    chartKey: input.chartKey,
    seed: input.seed,
    accountState: input.accountState,
  }).relativeUtility;
  const referenceCanonical = {
    lower: toCanonicalMicroUnits(reference.lower),
    central: toCanonicalMicroUnits(reference.central),
    upper: toCanonicalMicroUnits(reference.upper),
  };
  if (
    kernel.canonicalUtility.lower !== referenceCanonical.lower ||
    kernel.canonicalUtility.central !== referenceCanonical.central ||
    kernel.canonicalUtility.upper !== referenceCanonical.upper
  ) {
    throw new Error("Exact optimizer kernel diverged from the native reference micro-units");
  }
  return kernel;
}
