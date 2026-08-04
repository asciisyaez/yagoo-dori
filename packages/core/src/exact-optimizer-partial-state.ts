import { calculateCardParameters, mechanicsCardById, type CardMechanics } from "./mechanics";
import { publicCardById } from "./public-data";
import { songContextData } from "./song-contexts";
import {
  certifyCanonicalMicroUnitEnclosure,
  EXACT_OPTIMIZER_BULK_FALLBACK_REASONS,
  replayOrderedRepeatedBinary64Addition,
  transformRepeatedBinary64Addition,
  type Binary64Enclosure,
  type ExactOptimizerBulkFallbackReason,
} from "./exact-optimizer-bulk-accumulation";

/** The first serialized partial-state contract. */
export const EXACT_OPTIMIZER_PARTIAL_STATE_SCHEMA_VERSION = 1 as const;
export const EXACT_OPTIMIZER_REDUCED_SUFFIX_MANIFEST_ID =
  "yd-exact-optimizer-reduced-suffix-v1" as const;
export const EXACT_OPTIMIZER_REDUCED_SCOPE_HASH =
  "a53303691e95a289259b645b196ec3bea96fdc2609a6f527967d17fdc02e1871" as const;
export const EXACT_OPTIMIZER_REDUCED_SEED = 1_497_450_319 as const;
export const EXACT_OPTIMIZER_REDUCED_CHART_KEY = "m0206:expert" as const;
export const EXACT_OPTIMIZER_REDUCED_CHART_HASH =
  "9b1d3743fceb9be12e4a2c4905904f7c" as const;

const REDUCED_MEMBER_CARD_IDS = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
  "card-00018-5-uniq-0004-00",
  "card-00019-5-uniq-0016-00",
  "card-00039-5-uniq-0032-00",
] as const;

const REDUCED_LEADER_CARD_IDS = [
  "card-00001-5-uniq-0000-00",
  "card-00013-5-uniq-0002-00",
  "card-00019-5-uniq-0016-00",
  "card-00039-5-uniq-0032-00",
] as const;

const REDUCED_INVESTMENT_LAYER = "one-copy-maximum" as const;
const REDUCED_BLOOM_STAGE = 0 as const;
const REDUCED_BOARD_SIGNATURE =
  "declared-neutral-board-v1|declared-neutral|verified|fixture:exact-reduced-bruteforce|neutral-fixed|neutral-fixed" as const;
const REDUCED_INVESTMENT_SIGNATURE =
  "one-copy-maximum|bloom-0|duplicate-only-boosts-disabled" as const;
const REDUCED_SUFFIX_ORDERING_RULE =
  "lexicographic-card-id-with-all-legal-permutations" as const;
const PASS_ORDER = [
  "active-base",
  "active-special-support",
  "active-special-activation",
] as const;

type PassName = (typeof PASS_ORDER)[number];
type ReducedMemberCardId = (typeof REDUCED_MEMBER_CARD_IDS)[number];

export type ExactOptimizerAccumulatorPass = PassName;

/** A fixed-width hexadecimal representation of one IEEE-754 binary64 value. */
export type Binary64Bits = string & { readonly __binary64Bits: unique symbol };

export type PartialStatePhase =
  | "formation-incomplete"
  | "post-leader-resolution"
  | "per-chart-accumulation";

export type PartialStateFormationStatus =
  | "prefix"
  | "complete-awaiting-fixed-leader-resolution";

export type PartialStateInvestmentLayer = typeof REDUCED_INVESTMENT_LAYER;

export type PartialStateMemberSelection = Readonly<{
  cardId: string;
  investmentLayer: PartialStateInvestmentLayer;
  bloomStage: typeof REDUCED_BLOOM_STAGE;
}>;

export type PartialStateSuffix = Readonly<{
  memberCardIds: readonly string[];
}>;

export type SerializedPartialState = string & {
  readonly __serializedExactOptimizerPartialState: unique symbol;
};

export type SerializedPartialStateSuffix = string & {
  readonly __serializedExactOptimizerPartialStateSuffix: unique symbol;
};

export type DeferredContinuationFact = Readonly<{
  status: "deferred";
  reason: string;
}>;

type MaterializedContinuationFact = Readonly<{
  status: "materialized";
  payload: CanonicalJsonValue;
}>;

type ContinuationFact = DeferredContinuationFact | MaterializedContinuationFact;

export type PartialStateBinary64Enclosure = Readonly<{
  lower: Binary64Bits;
  upper: Binary64Bits;
}>;

export type PartialStateAccumulator = Readonly<{
  status: "not-started" | "in-progress" | "complete";
  passOrder: readonly PassName[];
  cursor: Readonly<{
    passIndex: number;
    passName: PassName;
    runIndex: number;
    noteIndex: number;
  }>;
  lowerCentralUpperAccumulatorEnclosures: Readonly<{
    lower: PartialStateBinary64Enclosure;
    central: PartialStateBinary64Enclosure;
    upper: PartialStateBinary64Enclosure;
  }>;
  fallbackReason: string | null;
  clampAndCanonicalBoundaryStatus: "not-started" | "certified" | "ordered-replay";
}>;

export type ExactOptimizerPartialState = Readonly<{
  schemaVersion: typeof EXACT_OPTIMIZER_PARTIAL_STATE_SCHEMA_VERSION;
  scope: Readonly<{
    manifestId: typeof EXACT_OPTIMIZER_REDUCED_SUFFIX_MANIFEST_ID;
    scopeHash: typeof EXACT_OPTIMIZER_REDUCED_SCOPE_HASH;
    seed: typeof EXACT_OPTIMIZER_REDUCED_SEED;
    boardSignature: typeof REDUCED_BOARD_SIGNATURE;
    investmentSignature: typeof REDUCED_INVESTMENT_SIGNATURE;
  }>;
  fixedLeader: Readonly<{
    cardId: string;
    talentId: string;
    triggerContextSignature: string;
  }>;
  phase: PartialStatePhase;
  formationStatus: PartialStateFormationStatus;
  prefix: Readonly<{
    depth: number;
    orderedMembers: readonly Readonly<{
      slot: number;
      cardId: string;
      talentId: string;
      rarity: 4 | 5;
      attribute: "cute" | "pure" | "happy";
      groups: readonly string[];
      investmentLayer: PartialStateInvestmentLayer;
      bloomStage: typeof REDUCED_BLOOM_STAGE;
    }>[];
    canonicalSortedMemberIds: readonly string[];
    remainingActionIds: readonly string[];
    suffixOrderingRule: typeof REDUCED_SUFFIX_ORDERING_RULE;
    selectedCount: number;
    selectedFiveStarCount: number;
    remainingFiveStarBudget: number;
    talentIds: readonly string[];
    attributeCounts: Readonly<Record<"cute" | "pure" | "happy", number>>;
    groupCounts: Readonly<Record<string, number>>;
  }>;
  chartContext: Readonly<{
    chartKey: typeof EXACT_OPTIMIZER_REDUCED_CHART_KEY;
    songId: string;
    expectedChartHash: typeof EXACT_OPTIMIZER_REDUCED_CHART_HASH;
    singerTalentIds: readonly string[];
    fullComboNoteCount: number;
    playingMilliseconds: number;
    chartOrderSignature: string;
  }>;
  memberFacts: Readonly<{
    progressionStateAndParametersBySlot: readonly Readonly<{
      slot: number;
      cardId: string;
      sourceRef: string;
      parameterSourceRefs: readonly string[];
      level: number;
      activeSkillLevel: number;
      passiveSkillLevel: number;
      specialSkillLevel: number;
      connectEffectLevel: number;
      allParameterPermilUp: number;
      parameterBaseValue: number;
      liveDeckPowerPermyriadUp: number;
      parameters: Readonly<{
        performance: number;
        technique: number;
        sense: number;
      }>;
    }>[];
    activeTimingBySlot: readonly Readonly<{
      slot: number;
      cardId: string;
      activeSkillLevel: number;
      cooldownMilliseconds: number | null;
      durationMilliseconds: number | null;
      activationProbabilityPermil: number | null;
    }>[];
    activeValueAndProbabilityLedger: ContinuationFact;
  }>;
  leaderAndTriggerFacts: ContinuationFact;
  specialFacts: ContinuationFact;
  arithmetic: PartialStateAccumulator;
  comparison: Readonly<{
    prefixTieKey: string;
    fullCandidateTieKeyOrDeferred: string | null;
    suffixIdentity: Readonly<{
      remainingActionIds: readonly string[];
      orderingRule: typeof REDUCED_SUFFIX_ORDERING_RULE;
    }>;
    canonicalTupleOrDeferred: Readonly<{
      status: "deferred";
    }> | Readonly<{
      status: "materialized";
      lowerMicroUnits: number;
      centralMicroUnits: number;
      upperMicroUnits: number;
    }>;
    b2Status: "not-eligible-before-completion" | "strict-loss" | "promote-b3";
    b3PromotionReason: string | null;
    finalistStatus: "not-finalist" | "candidate-finalist" | "promoted-b3";
  }>;
}>;

export type PartialStateConstructionInput = Readonly<{
  leaderOutfitCardId: string;
  orderedMemberCardIds: readonly string[];
}>;

export type PartialStateResumeResult = Readonly<{
  state: ExactOptimizerPartialState;
  serializedState: SerializedPartialState;
  completion: "incomplete" | "complete-awaiting-fixed-leader-resolution";
}>;

export type PartialStateCatalog = Readonly<{
  manifestId: typeof EXACT_OPTIMIZER_REDUCED_SUFFIX_MANIFEST_ID;
  scopeHash: typeof EXACT_OPTIMIZER_REDUCED_SCOPE_HASH;
  memberCardIds: readonly ReducedMemberCardId[];
  leaderOutfitCardIds: readonly string[];
  chartKey: typeof EXACT_OPTIMIZER_REDUCED_CHART_KEY;
  expectedChartHash: typeof EXACT_OPTIMIZER_REDUCED_CHART_HASH;
  investmentLayer: PartialStateInvestmentLayer;
  bloomStageByCardId: Readonly<Record<ReducedMemberCardId, typeof REDUCED_BLOOM_STAGE>>;
  boardSignature: typeof REDUCED_BOARD_SIGNATURE;
}>;

export const EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION = 1 as const;

export type SerializedPartialStateAccumulatorCheckpoint = string & {
  readonly __serializedExactOptimizerPartialStateAccumulatorCheckpoint: unique symbol;
};

export type SerializedPartialStateAccumulatorLedger = string & {
  readonly __serializedExactOptimizerPartialStateAccumulatorLedger: unique symbol;
};

export type PartialStateAccumulatorCheckpoint = Readonly<{
  schemaVersion: typeof EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION;
  passName: ExactOptimizerAccumulatorPass;
  runCursor: number;
  noteCursor: number;
  enclosures: Readonly<{
    lower: PartialStateBinary64Enclosure;
    central: PartialStateBinary64Enclosure;
    upper: PartialStateBinary64Enclosure;
  }>;
  fallbackReasons: readonly ExactOptimizerBulkFallbackReason[];
}>;

export type PartialStateAccumulatorRun = Readonly<{
  passName: ExactOptimizerAccumulatorPass;
  runIndex: number;
  noteIndex: number;
  multiplicity: number;
  contributions: Readonly<{
    lower: Binary64Bits;
    central: Binary64Bits;
    upper: Binary64Bits;
  }>;
  expectedContributions?: Readonly<{
    lower: Binary64Bits;
    central: Binary64Bits;
    upper: Binary64Bits;
  }>;
}>;

export type PartialStateAccumulatorLedger = Readonly<{
  schemaVersion: typeof EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION;
  passName: ExactOptimizerAccumulatorPass;
  runs: readonly PartialStateAccumulatorRun[];
}>;

export type PartialStateAccumulatorCanonicalResult = Readonly<{
  kind: "bulk-certified-reference-equivalent" | "ordered-replay-required";
  canonicalMicroUnits: number | null;
  enclosure: PartialStateBinary64Enclosure | null;
  fallbackReason: ExactOptimizerBulkFallbackReason | null;
}>;

export type PartialStateAccumulatorResumeResult = Readonly<{
  passName: ExactOptimizerAccumulatorPass;
  consumedRunCount: number;
  serializedCheckpoint: SerializedPartialStateAccumulatorCheckpoint;
  enclosures: Readonly<{
    lower: PartialStateBinary64Enclosure;
    central: PartialStateBinary64Enclosure;
    upper: PartialStateBinary64Enclosure;
  }>;
  canonical: Readonly<{
    lower: PartialStateAccumulatorCanonicalResult;
    central: PartialStateAccumulatorCanonicalResult;
    upper: PartialStateAccumulatorCanonicalResult;
  }>;
  fallbackReasons: readonly ExactOptimizerBulkFallbackReason[];
}>;

type CanonicalJsonPrimitive = null | boolean | number | string;
type CanonicalJsonObject = Readonly<{ readonly [key: string]: CanonicalJsonValue }>;
type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | CanonicalJsonObject;

const ZERO_BINARY64_BITS = encodeBinary64(0);

const REDUCED_GROUP_IDS = Object.freeze(
  [...new Set(REDUCED_MEMBER_CARD_IDS.flatMap((cardId) => publicCardById.get(cardId)?.groups ?? []))]
    .sort(),
);

export const exactOptimizerPartialStateCatalog: PartialStateCatalog = Object.freeze({
  manifestId: EXACT_OPTIMIZER_REDUCED_SUFFIX_MANIFEST_ID,
  scopeHash: EXACT_OPTIMIZER_REDUCED_SCOPE_HASH,
  memberCardIds: Object.freeze([...REDUCED_MEMBER_CARD_IDS]),
  leaderOutfitCardIds: Object.freeze([...REDUCED_LEADER_CARD_IDS]),
  chartKey: EXACT_OPTIMIZER_REDUCED_CHART_KEY,
  expectedChartHash: EXACT_OPTIMIZER_REDUCED_CHART_HASH,
  investmentLayer: REDUCED_INVESTMENT_LAYER,
  bloomStageByCardId: Object.freeze(
    Object.fromEntries(REDUCED_MEMBER_CARD_IDS.map((cardId) => [cardId, REDUCED_BLOOM_STAGE])) as Record<
      ReducedMemberCardId,
      typeof REDUCED_BLOOM_STAGE
    >,
  ),
  boardSignature: REDUCED_BOARD_SIGNATURE,
});

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

/** Encode any finite or non-finite JS number without losing its bit pattern. */
export function encodeBinary64(value: number): Binary64Bits {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  const high = view.getUint32(0, false).toString(16).padStart(8, "0");
  const low = view.getUint32(4, false).toString(16).padStart(8, "0");
  return `0x${high}${low}` as Binary64Bits;
}

export function decodeBinary64(bits: Binary64Bits): number {
  assertBinary64Bits(bits, "binary64 value");
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Number.parseInt(bits.slice(2, 10), 16), false);
  view.setUint32(4, Number.parseInt(bits.slice(10), 16), false);
  return view.getFloat64(0, false);
}

function assertBinary64Bits(value: unknown, label: string): asserts value is Binary64Bits {
  if (typeof value !== "string" || !/^0x[0-9a-f]{16}$/.test(value)) {
    throw new Error(`${label} must be a fixed-width lowercase binary64 hex value`);
  }
}

function canonicalize(value: CanonicalJsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error("Canonical state numbers must be safe integers; encode floats as binary64 bits");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  const object = value as CanonicalJsonObject;
  const entries = Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key]!)}`);
  return `{${entries.join(",")}}`;
}

function canonicalJson(value: unknown): CanonicalJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new Error("Canonical state numbers must be safe integers; encode floats as binary64 bits");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalJson(entry));
  assertRecord(value, "Canonical value");
  const object = value as Record<string, unknown>;
  const result: Record<string, CanonicalJsonValue> = {};
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) throw new Error(`Canonical value contains undefined at ${key}`);
    result[key] = canonicalJson(object[key]);
  }
  return result;
}

function assertAccumulatorPass(
  value: unknown,
  label: string,
): asserts value is ExactOptimizerAccumulatorPass {
  if (typeof value !== "string" || !PASS_ORDER.includes(value as ExactOptimizerAccumulatorPass)) {
    throw new Error(`${label} is not a recognized exact-optimizer accumulation pass`);
  }
}

function assertSafeNonnegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || Object.is(value, -0)) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function assertPositiveSafeInteger(value: unknown, label: string): asserts value is number {
  assertSafeNonnegativeInteger(value, label);
  if ((value as number) <= 0) throw new Error(`${label} must be positive`);
}

function assertFallbackReason(
  value: unknown,
  label: string,
): asserts value is ExactOptimizerBulkFallbackReason {
  if (
    typeof value !== "string" ||
    !EXACT_OPTIMIZER_BULK_FALLBACK_REASONS.includes(value as ExactOptimizerBulkFallbackReason)
  ) {
    throw new Error(`${label} is not a recognized exact-optimizer fallback reason`);
  }
}

function parseAccumulatorEnclosure(value: unknown, label: string): PartialStateBinary64Enclosure {
  assertRecord(value, label);
  assertBinary64Bits(value.lower, `${label}.lower`);
  assertBinary64Bits(value.upper, `${label}.upper`);
  return Object.freeze({ lower: value.lower, upper: value.upper });
}

function validateAccumulatorCheckpoint(value: unknown): PartialStateAccumulatorCheckpoint {
  assertRecord(value, "Accumulator checkpoint");
  if (value.schemaVersion !== EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION) {
    throw new Error("Unsupported accumulator checkpoint schema version");
  }
  assertAccumulatorPass(value.passName, "Accumulator checkpoint passName");
  assertSafeNonnegativeInteger(value.runCursor, "Accumulator checkpoint runCursor");
  assertSafeNonnegativeInteger(value.noteCursor, "Accumulator checkpoint noteCursor");
  assertRecord(value.enclosures, "Accumulator checkpoint enclosures");
  const fallbackReasons = value.fallbackReasons;
  if (!Array.isArray(fallbackReasons)) {
    throw new Error("Accumulator checkpoint fallbackReasons must be an array");
  }
  const normalizedFallbackReasons = fallbackReasons.map((reason, index) => {
    assertFallbackReason(reason, `Accumulator checkpoint fallbackReasons[${index}]`);
    return reason;
  });
  return deepFreeze({
    schemaVersion: EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION,
    passName: value.passName,
    runCursor: value.runCursor,
    noteCursor: value.noteCursor,
    enclosures: Object.freeze({
      lower: parseAccumulatorEnclosure(value.enclosures.lower, "Accumulator checkpoint lower"),
      central: parseAccumulatorEnclosure(value.enclosures.central, "Accumulator checkpoint central"),
      upper: parseAccumulatorEnclosure(value.enclosures.upper, "Accumulator checkpoint upper"),
    }),
    fallbackReasons: Object.freeze(normalizedFallbackReasons),
  });
}

function validateAccumulatorRun(
  value: unknown,
  label: string,
  expectedPass: ExactOptimizerAccumulatorPass,
): PartialStateAccumulatorRun {
  assertRecord(value, label);
  assertAccumulatorPass(value.passName, `${label}.passName`);
  if (value.passName !== expectedPass) throw new Error(`${label}.passName does not match the ledger pass`);
  assertSafeNonnegativeInteger(value.runIndex, `${label}.runIndex`);
  assertSafeNonnegativeInteger(value.noteIndex, `${label}.noteIndex`);
  assertPositiveSafeInteger(value.multiplicity, `${label}.multiplicity`);
  assertRecord(value.contributions, `${label}.contributions`);
  assertBinary64Bits(value.contributions.lower, `${label}.contributions.lower`);
  assertBinary64Bits(value.contributions.central, `${label}.contributions.central`);
  assertBinary64Bits(value.contributions.upper, `${label}.contributions.upper`);
  const expectedContributions = value.expectedContributions;
  let normalizedExpectedContributions:
    | Readonly<{ lower: Binary64Bits; central: Binary64Bits; upper: Binary64Bits }>
    | undefined;
  if (expectedContributions !== undefined) {
    assertRecord(expectedContributions, `${label}.expectedContributions`);
    assertBinary64Bits(expectedContributions.lower, `${label}.expectedContributions.lower`);
    assertBinary64Bits(expectedContributions.central, `${label}.expectedContributions.central`);
    assertBinary64Bits(expectedContributions.upper, `${label}.expectedContributions.upper`);
    normalizedExpectedContributions = Object.freeze({
      lower: expectedContributions.lower,
      central: expectedContributions.central,
      upper: expectedContributions.upper,
    });
  }
  return deepFreeze({
    passName: value.passName,
    runIndex: value.runIndex,
    noteIndex: value.noteIndex,
    multiplicity: value.multiplicity,
    contributions: Object.freeze({
      lower: value.contributions.lower,
      central: value.contributions.central,
      upper: value.contributions.upper,
    }),
    ...(normalizedExpectedContributions === undefined
      ? {}
      : {
          expectedContributions: normalizedExpectedContributions,
        }),
  });
}

function validateAccumulatorLedger(value: unknown): PartialStateAccumulatorLedger {
  assertRecord(value, "Accumulator ledger");
  if (value.schemaVersion !== EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION) {
    throw new Error("Unsupported accumulator ledger schema version");
  }
  const passName = value.passName;
  assertAccumulatorPass(passName, "Accumulator ledger passName");
  if (!Array.isArray(value.runs)) throw new Error("Accumulator ledger runs must be an array");
  return deepFreeze({
    schemaVersion: EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION,
    passName,
    runs: Object.freeze(
      value.runs.map((run, index) =>
        validateAccumulatorRun(run, `Accumulator ledger runs[${index}]`, passName),
      ),
    ),
  });
}

function parseCanonicalAccumulatorJson<T>(serialized: string, label: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (canonicalize(canonicalJson(parsed)) !== serialized) {
    throw new Error(`${label} is not canonical`);
  }
  return parsed as T;
}

export function serializeExactOptimizerAccumulatorCheckpoint(
  checkpoint: PartialStateAccumulatorCheckpoint,
): SerializedPartialStateAccumulatorCheckpoint {
  const validated = validateAccumulatorCheckpoint(checkpoint);
  return canonicalize(canonicalJson(validated)) as SerializedPartialStateAccumulatorCheckpoint;
}

export function serializeExactOptimizerAccumulatorLedger(
  ledger: PartialStateAccumulatorLedger,
): SerializedPartialStateAccumulatorLedger {
  const validated = validateAccumulatorLedger(ledger);
  return canonicalize(canonicalJson(validated)) as SerializedPartialStateAccumulatorLedger;
}

function parseAccumulatorCheckpoint(
  serialized: SerializedPartialStateAccumulatorCheckpoint,
): PartialStateAccumulatorCheckpoint {
  return validateAccumulatorCheckpoint(
    parseCanonicalAccumulatorJson<PartialStateAccumulatorCheckpoint>(
      serialized,
      "Serialized accumulator checkpoint",
    ),
  );
}

function parseAccumulatorLedger(
  serialized: SerializedPartialStateAccumulatorLedger,
): PartialStateAccumulatorLedger {
  return validateAccumulatorLedger(
    parseCanonicalAccumulatorJson<PartialStateAccumulatorLedger>(serialized, "Serialized accumulator ledger"),
  );
}

function decodeAccumulatorEnclosure(enclosure: PartialStateBinary64Enclosure): Binary64Enclosure {
  return {
    lower: decodeBinary64(enclosure.lower),
    upper: decodeBinary64(enclosure.upper),
  };
}

function encodeAccumulatorEnclosure(enclosure: Binary64Enclosure): PartialStateBinary64Enclosure {
  return Object.freeze({
    lower: encodeBinary64(enclosure.lower),
    upper: encodeBinary64(enclosure.upper),
  });
}

function advanceAccumulatorEnclosure(
  incoming: PartialStateBinary64Enclosure,
  contributionBits: Binary64Bits,
  expectedContributionBits: Binary64Bits,
  multiplicity: number,
): Readonly<{
  enclosure: PartialStateBinary64Enclosure;
  fallbackReason: ExactOptimizerBulkFallbackReason | null;
}> {
  const contribution = decodeBinary64(contributionBits);
  const expectedContribution = decodeBinary64(expectedContributionBits);
  const transformed = transformRepeatedBinary64Addition({
    incoming: decodeAccumulatorEnclosure(incoming),
    contribution,
    expectedContribution,
    multiplicity,
  });
  if (transformed.kind === "bulk-run-enclosure") {
    return Object.freeze({
      enclosure: encodeAccumulatorEnclosure(transformed.enclosure),
      fallbackReason: null,
    });
  }
  // A constant run may be replayed with its single contribution; a run whose
  // boundary contributions differ is not constant, and this ledger schema
  // carries no per-note values, so replay would fabricate an ordered result.
  if (transformed.fallbackReason === "contribution-mismatch") {
    throw new Error(
      "Accumulator ledger run is not constant; state-only continuation cannot replay per-note values the ledger does not carry",
    );
  }
  const decodedIncoming = decodeAccumulatorEnclosure(incoming);
  return Object.freeze({
    enclosure: encodeAccumulatorEnclosure({
      lower: replayOrderedRepeatedBinary64Addition(
        decodedIncoming.lower,
        contribution,
        multiplicity,
      ),
      upper: replayOrderedRepeatedBinary64Addition(
        decodedIncoming.upper,
        contribution,
        multiplicity,
      ),
    }),
    fallbackReason: transformed.fallbackReason,
  });
}

function certifyAccumulatorEnclosure(
  enclosure: PartialStateBinary64Enclosure,
): PartialStateAccumulatorCanonicalResult {
  const result = certifyCanonicalMicroUnitEnclosure(decodeAccumulatorEnclosure(enclosure));
  if (result.kind === "ordered-replay-required") {
    return Object.freeze({
      kind: result.kind,
      canonicalMicroUnits: null,
      enclosure: result.enclosure ? encodeAccumulatorEnclosure(result.enclosure) : null,
      fallbackReason: result.fallbackReason,
    });
  }
  return Object.freeze({
    kind: result.kind,
    canonicalMicroUnits: result.canonicalMicroUnits,
    enclosure: encodeAccumulatorEnclosure(result.enclosure),
    fallbackReason: null,
  });
}

function appendFallbackReason(
  reasons: ExactOptimizerBulkFallbackReason[],
  reason: ExactOptimizerBulkFallbackReason | null,
): void {
  if (reason !== null && !reasons.includes(reason)) reasons.push(reason);
}

function executeAccumulatorRuns(
  checkpoint: PartialStateAccumulatorCheckpoint,
  ledger: PartialStateAccumulatorLedger,
): PartialStateAccumulatorResumeResult {
  if (checkpoint.passName !== ledger.passName) {
    throw new Error("Accumulator checkpoint and ledger pass identities differ");
  }
  let nextRunCursor = checkpoint.runCursor;
  let nextNoteCursor = checkpoint.noteCursor;
  const fallbackReasons = [...checkpoint.fallbackReasons];
  const enclosures = {
    lower: checkpoint.enclosures.lower,
    central: checkpoint.enclosures.central,
    upper: checkpoint.enclosures.upper,
  };
  for (const [index, run] of ledger.runs.entries()) {
    if (run.runIndex !== nextRunCursor) {
      throw new Error(`Accumulator ledger run ${index} does not match the checkpoint run cursor`);
    }
    if (run.noteIndex !== nextNoteCursor) {
      throw new Error(`Accumulator ledger run ${index} does not match the checkpoint note cursor`);
    }
    const lower = advanceAccumulatorEnclosure(
      enclosures.lower,
      run.contributions.lower,
      run.expectedContributions?.lower ?? run.contributions.lower,
      run.multiplicity,
    );
    const central = advanceAccumulatorEnclosure(
      enclosures.central,
      run.contributions.central,
      run.expectedContributions?.central ?? run.contributions.central,
      run.multiplicity,
    );
    const upper = advanceAccumulatorEnclosure(
      enclosures.upper,
      run.contributions.upper,
      run.expectedContributions?.upper ?? run.contributions.upper,
      run.multiplicity,
    );
    enclosures.lower = lower.enclosure;
    enclosures.central = central.enclosure;
    enclosures.upper = upper.enclosure;
    appendFallbackReason(fallbackReasons, lower.fallbackReason);
    appendFallbackReason(fallbackReasons, central.fallbackReason);
    appendFallbackReason(fallbackReasons, upper.fallbackReason);
    nextRunCursor += 1;
    nextNoteCursor += run.multiplicity;
  }
  const finalEnclosures = Object.freeze({
    lower: enclosures.lower,
    central: enclosures.central,
    upper: enclosures.upper,
  });
  const canonical = Object.freeze({
    lower: certifyAccumulatorEnclosure(finalEnclosures.lower),
    central: certifyAccumulatorEnclosure(finalEnclosures.central),
    upper: certifyAccumulatorEnclosure(finalEnclosures.upper),
  });
  const finalCheckpoint = serializeExactOptimizerAccumulatorCheckpoint({
    schemaVersion: EXACT_OPTIMIZER_PARTIAL_STATE_ACCUMULATOR_SCHEMA_VERSION,
    passName: checkpoint.passName,
    runCursor: nextRunCursor,
    noteCursor: nextNoteCursor,
    enclosures: finalEnclosures,
    fallbackReasons: Object.freeze(fallbackReasons),
  });
  return Object.freeze({
    passName: checkpoint.passName,
    consumedRunCount: ledger.runs.length,
    serializedCheckpoint: finalCheckpoint,
    enclosures: finalEnclosures,
    canonical,
    fallbackReasons: Object.freeze(fallbackReasons),
  });
}

/**
 * Continue one source-order pass from a serialized binary64 checkpoint. This
 * path is intentionally independent of the pinned catalog and evaluator: its
 * only semantic inputs are the checkpoint bits and the remaining run ledger.
 */
export function resumeExactOptimizerAccumulatorRuns(
  serializedCheckpoint: SerializedPartialStateAccumulatorCheckpoint,
  serializedRemainingLedger: SerializedPartialStateAccumulatorLedger,
): PartialStateAccumulatorResumeResult {
  return executeAccumulatorRuns(
    parseAccumulatorCheckpoint(serializedCheckpoint),
    parseAccumulatorLedger(serializedRemainingLedger),
  );
}

let cachedChartContext: ExactOptimizerPartialState["chartContext"] | null = null;

function chartContext(): ExactOptimizerPartialState["chartContext"] {
  if (cachedChartContext) return cachedChartContext;
  const chart = songContextData.charts.find((candidate) => candidate.key === EXACT_OPTIMIZER_REDUCED_CHART_KEY);
  if (!chart || chart.chartHash !== EXACT_OPTIMIZER_REDUCED_CHART_HASH) {
    throw new Error("Pinned reduced suffix chart drifted from the exact chart catalog");
  }
  const song = songContextData.songs.find((candidate) => candidate.id === chart.songId);
  if (!song) throw new Error(`Pinned reduced suffix chart has no song: ${chart.songId}`);
  const singers = Object.freeze([...song.singerTalentIds]);
  const chartOrderSignature = canonicalize({
    chartKey: chart.key,
    chartHash: chart.chartHash,
    songId: chart.songId,
    fullComboNoteCount: chart.fullComboNoteCount,
    playingMilliseconds: song.playingMilliseconds,
    singerTalentIds: singers,
  });
  cachedChartContext = Object.freeze({
    chartKey: EXACT_OPTIMIZER_REDUCED_CHART_KEY,
    songId: chart.songId,
    expectedChartHash: EXACT_OPTIMIZER_REDUCED_CHART_HASH,
    singerTalentIds: singers,
    fullComboNoteCount: chart.fullComboNoteCount,
    playingMilliseconds: song.playingMilliseconds,
    chartOrderSignature,
  });
  return cachedChartContext;
}

function cardPair(cardId: string): { publicCard: NonNullable<ReturnType<typeof publicCardById.get>>; mechanics: CardMechanics } {
  const publicCard = publicCardById.get(cardId);
  const mechanics = mechanicsCardById.get(cardId);
  if (!publicCard || !mechanics) throw new Error(`Pinned reduced suffix card is missing: ${cardId}`);
  if (publicCard.talentId !== mechanics.talentId) throw new Error(`Card catalog talent drifted: ${cardId}`);
  return { publicCard, mechanics };
}

function assertPinnedCatalog(): void {
  for (const cardId of REDUCED_MEMBER_CARD_IDS) {
    const { publicCard, mechanics } = cardPair(cardId);
    if (publicCard.rarity !== mechanics.rarity) throw new Error(`Card rarity drifted: ${cardId}`);
  }
  for (const cardId of REDUCED_LEADER_CARD_IDS) {
    const { publicCard, mechanics } = cardPair(cardId);
    if (publicCard.talentId !== mechanics.leaderOutfit.talentId) {
      throw new Error(`Leader talent drifted: ${cardId}`);
    }
  }
  const chart = chartContext();
  if (chart.chartKey !== exactOptimizerPartialStateCatalog.chartKey) {
    throw new Error("Reduced suffix catalog chart drifted");
  }
}

let pinnedCatalogValidated = false;

function ensurePinnedCatalog(): void {
  if (!pinnedCatalogValidated) {
    assertPinnedCatalog();
    pinnedCatalogValidated = true;
  }
}

function isReducedMemberCardId(cardId: string): cardId is ReducedMemberCardId {
  return (REDUCED_MEMBER_CARD_IDS as readonly string[]).includes(cardId);
}

function isReducedLeaderCardId(cardId: string): boolean {
  return (REDUCED_LEADER_CARD_IDS as readonly string[]).includes(cardId);
}

function makeCountMap(): { attributes: Record<"cute" | "pure" | "happy", number>; groups: Record<string, number> } {
  return {
    attributes: { cute: 0, pure: 0, happy: 0 },
    groups: Object.fromEntries(REDUCED_GROUP_IDS.map((groupId) => [groupId, 0])),
  };
}

function resolveOneCopyProgression(mechanics: CardMechanics): ExactOptimizerPartialState["memberFacts"]["progressionStateAndParametersBySlot"][number] {
  const state = mechanics.progression.oneCopy;
  const levelRow = mechanics.progression.levelCurve.find((candidate) => candidate.level === state.level);
  if (!levelRow) throw new Error(`Missing pinned progression level ${state.level}: ${mechanics.cardId}`);
  return {
    slot: 0,
    cardId: mechanics.cardId,
    sourceRef: mechanics.sourceRef,
    parameterSourceRefs: Object.freeze([...mechanics.parameterSourceRefs]),
    level: state.level,
    activeSkillLevel: state.activeSkillLevel,
    passiveSkillLevel: state.passiveSkillLevel,
    specialSkillLevel: state.specialSkillLevel,
    connectEffectLevel: state.connectEffectLevel,
    allParameterPermilUp: state.allParameterPermilUp,
    parameterBaseValue: levelRow.parameterBaseValue,
    liveDeckPowerPermyriadUp: levelRow.liveDeckPowerPermyriadUp,
    parameters: calculateCardParameters(mechanics, state.level, state.allParameterPermilUp),
  };
}

function makeMemberFacts(
  orderedMembers: ExactOptimizerPartialState["prefix"]["orderedMembers"],
): ExactOptimizerPartialState["memberFacts"] {
  const progression = orderedMembers.map((member, index) => {
    const fact = resolveOneCopyProgression(cardPair(member.cardId).mechanics);
    return Object.freeze({ ...fact, slot: index + 1 });
  });
  const activeTiming = orderedMembers.map((member, index) => {
    const mechanics = cardPair(member.cardId).mechanics;
    const skill = mechanics.skills.active.find(
      (candidate) => candidate.level === progression[index]!.activeSkillLevel,
    );
    if (!skill) throw new Error(`Missing pinned Active level ${progression[index]!.activeSkillLevel}: ${member.cardId}`);
    return Object.freeze({
      slot: index + 1,
      cardId: member.cardId,
      activeSkillLevel: skill.level,
      cooldownMilliseconds: skill.cooldownMilliseconds,
      durationMilliseconds: skill.durationMilliseconds,
      activationProbabilityPermil: skill.activationProbabilityPermil,
    });
  });
  return Object.freeze({
    progressionStateAndParametersBySlot: Object.freeze(progression),
    activeTimingBySlot: Object.freeze(activeTiming),
    activeValueAndProbabilityLedger: {
      status: "deferred",
      reason: "requires-complete-formation-and-fixed-leader-resolution",
    },
  });
}

function makeAccumulator(): PartialStateAccumulator {
  const point: PartialStateBinary64Enclosure = Object.freeze({ lower: ZERO_BINARY64_BITS, upper: ZERO_BINARY64_BITS });
  return Object.freeze({
    status: "not-started",
    passOrder: PASS_ORDER,
    cursor: Object.freeze({ passIndex: 0, passName: PASS_ORDER[0], runIndex: 0, noteIndex: 0 }),
    lowerCentralUpperAccumulatorEnclosures: Object.freeze({ lower: point, central: point, upper: point }),
    fallbackReason: null,
    clampAndCanonicalBoundaryStatus: "not-started",
  });
}

function makeDeferred(reason: string): DeferredContinuationFact {
  return Object.freeze({ status: "deferred", reason });
}

function normalizePrefixMember(cardId: string, slot: number): ExactOptimizerPartialState["prefix"]["orderedMembers"][number] {
  if (!isReducedMemberCardId(cardId)) throw new Error(`Member is outside the pinned reduced roster: ${cardId}`);
  const { publicCard } = cardPair(cardId);
  return Object.freeze({
    slot,
    cardId,
    talentId: publicCard.talentId,
    rarity: publicCard.rarity,
    attribute: publicCard.attribute,
    groups: Object.freeze([...publicCard.groups].sort()),
    investmentLayer: REDUCED_INVESTMENT_LAYER,
    bloomStage: REDUCED_BLOOM_STAGE,
  });
}

function buildState(input: PartialStateConstructionInput): ExactOptimizerPartialState {
  ensurePinnedCatalog();
  if (!isReducedLeaderCardId(input.leaderOutfitCardId)) {
    throw new Error(`Leader is outside the pinned reduced roster: ${input.leaderOutfitCardId}`);
  }
  if (input.orderedMemberCardIds.length > 5) {
    throw new Error("A partial state cannot contain more than five Members");
  }
  const leader = cardPair(input.leaderOutfitCardId);
  const orderedMembers = input.orderedMemberCardIds.map((cardId, index) => normalizePrefixMember(cardId, index + 1));
  const talentIds = orderedMembers.map((member) => member.talentId);
  if (new Set(input.orderedMemberCardIds).size !== input.orderedMemberCardIds.length) {
    throw new Error("A partial state prefix cannot repeat a Member card");
  }
  if (new Set(talentIds).size !== talentIds.length) {
    throw new Error("A partial state prefix cannot repeat a Member talent");
  }
  const counts = makeCountMap();
  for (const member of orderedMembers) {
    counts.attributes[member.attribute] += 1;
    for (const groupId of member.groups) counts.groups[groupId] = (counts.groups[groupId] ?? 0) + 1;
  }
  const selectedFiveStarCount = orderedMembers.filter((member) => member.rarity === 5).length;
  if (selectedFiveStarCount > 5) throw new Error("A partial state exceeds the five-star budget");
  const sortedMemberIds = Object.freeze([...input.orderedMemberCardIds].sort());
  const remainingActionIds = Object.freeze(
    REDUCED_MEMBER_CARD_IDS.filter((cardId) => !input.orderedMemberCardIds.includes(cardId)),
  );
  const chart = chartContext();
  const triggerContextSignature = canonicalize({
    leaderOutfitCardId: input.leaderOutfitCardId,
    chartKey: chart.chartKey,
    songId: chart.songId,
    singerTalentIds: chart.singerTalentIds,
    boardSignature: REDUCED_BOARD_SIGNATURE,
  });
  const formationStatus: PartialStateFormationStatus = orderedMembers.length === 5
    ? "complete-awaiting-fixed-leader-resolution"
    : "prefix";
  const state: ExactOptimizerPartialState = {
    schemaVersion: EXACT_OPTIMIZER_PARTIAL_STATE_SCHEMA_VERSION,
    scope: {
      manifestId: EXACT_OPTIMIZER_REDUCED_SUFFIX_MANIFEST_ID,
      scopeHash: EXACT_OPTIMIZER_REDUCED_SCOPE_HASH,
      seed: EXACT_OPTIMIZER_REDUCED_SEED,
      boardSignature: REDUCED_BOARD_SIGNATURE,
      investmentSignature: REDUCED_INVESTMENT_SIGNATURE,
    },
    fixedLeader: {
      cardId: input.leaderOutfitCardId,
      talentId: leader.mechanics.leaderOutfit.talentId,
      triggerContextSignature,
    },
    phase: "formation-incomplete",
    formationStatus,
    prefix: {
      depth: orderedMembers.length,
      orderedMembers: Object.freeze(orderedMembers),
      canonicalSortedMemberIds: sortedMemberIds,
      remainingActionIds,
      suffixOrderingRule: REDUCED_SUFFIX_ORDERING_RULE,
      selectedCount: orderedMembers.length,
      selectedFiveStarCount,
      remainingFiveStarBudget: 5 - selectedFiveStarCount,
      talentIds: Object.freeze([...talentIds]),
      attributeCounts: Object.freeze(counts.attributes),
      groupCounts: Object.freeze(counts.groups),
    },
    chartContext: chart,
    memberFacts: makeMemberFacts(orderedMembers),
    leaderAndTriggerFacts: makeDeferred("requires-complete-formation-and-fixed-leader-resolution"),
    specialFacts: makeDeferred("requires-complete-formation-and-fixed-leader-resolution"),
    arithmetic: makeAccumulator(),
    comparison: {
      prefixTieKey: `${input.leaderOutfitCardId}|${sortedMemberIds.join("|")}`,
      fullCandidateTieKeyOrDeferred: null,
      suffixIdentity: {
        remainingActionIds,
        orderingRule: REDUCED_SUFFIX_ORDERING_RULE,
      },
      canonicalTupleOrDeferred: { status: "deferred" },
      b2Status: "not-eligible-before-completion",
      b3PromotionReason: null,
      finalistStatus: "not-finalist",
    },
  };
  return deepFreeze(state);
}

/** Construct state from scalar IDs only; no FormationInput or evaluator object is accepted. */
export function createExactOptimizerPartialState(
  input: PartialStateConstructionInput,
): ExactOptimizerPartialState {
  return buildState(input);
}

function combinations(values: readonly string[], size: number): string[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const head = values[0]!;
  const tail = values.slice(1);
  return [
    ...combinations(tail, size - 1).map((rest) => [head, ...rest]),
    ...combinations(tail, size),
  ];
}

function permutations(values: readonly string[]): string[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]),
  );
}

function isLegalMemberSet(memberCardIds: readonly string[]): boolean {
  const cards = memberCardIds.map((cardId) => cardPair(cardId).publicCard);
  return new Set(cards.map((card) => card.talentId)).size === cards.length &&
    cards.filter((card) => card.rarity === 5).length <= 5;
}

/** The exact 56 unordered Member sets selected by the pinned reduced fixture. */
export function enumerateReducedLegalMemberSets(): readonly (readonly ReducedMemberCardId[])[] {
  ensurePinnedCatalog();
  const teams = combinations([...REDUCED_MEMBER_CARD_IDS], 5)
    .filter((team) => isLegalMemberSet(team))
    .map((team) => Object.freeze(team as ReducedMemberCardId[]));
  if (teams.length !== 56) throw new Error(`Pinned reduced roster produced ${teams.length} legal sets, expected 56`);
  return Object.freeze(teams);
}

function parseSuffix(serializedSuffix: SerializedPartialStateSuffix): PartialStateSuffix {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedSuffix);
  } catch {
    throw new Error("Serialized suffix is not valid JSON");
  }
  if (canonicalize(canonicalJson(parsed)) !== serializedSuffix) {
    throw new Error("Serialized suffix is not canonical");
  }
  assertRecord(parsed, "Serialized suffix");
  const memberCardIds = parsed.memberCardIds;
  if (!Array.isArray(memberCardIds)) throw new Error("Serialized suffix memberCardIds must be an array");
  for (const [index, cardId] of memberCardIds.entries()) {
    assertString(cardId, `Serialized suffix memberCardIds[${index}]`);
    if (!isReducedMemberCardId(cardId)) throw new Error(`Suffix card is outside the pinned roster: ${cardId}`);
  }
  if (new Set(memberCardIds).size !== memberCardIds.length) throw new Error("Serialized suffix repeats a Member card");
  return deepFreeze({ memberCardIds: Object.freeze([...memberCardIds]) });
}

export function serializeExactOptimizerPartialStateSuffix(
  suffix: PartialStateSuffix,
): SerializedPartialStateSuffix {
  const memberCardIds = [...suffix.memberCardIds];
  if (new Set(memberCardIds).size !== memberCardIds.length) throw new Error("Suffix repeats a Member card");
  for (const cardId of memberCardIds) {
    if (!isReducedMemberCardId(cardId)) throw new Error(`Suffix card is outside the pinned roster: ${cardId}`);
  }
  return canonicalize(canonicalJson({ memberCardIds })) as SerializedPartialStateSuffix;
}

function stateFromInput(state: ExactOptimizerPartialState | SerializedPartialState): ExactOptimizerPartialState {
  return typeof state === "string" ? parseExactOptimizerPartialState(state) : validatePartialState(state);
}

/** Enumerate every ordered terminal suffix that completes a legal reduced team. */
export function enumerateExactOptimizerLegalSuffixes(
  stateInput: ExactOptimizerPartialState | SerializedPartialState,
): readonly SerializedPartialStateSuffix[] {
  const state = stateFromInput(stateInput);
  const prefixIds = state.prefix.orderedMembers.map((member) => member.cardId);
  const prefixSet = new Set(prefixIds);
  const suffixes = new Set<string>();
  for (const team of enumerateReducedLegalMemberSets()) {
    if (!prefixIds.every((cardId) => team.some((teamCardId) => teamCardId === cardId))) continue;
    const remaining = team.filter((cardId) => !prefixSet.has(cardId));
    for (const suffix of permutations(remaining)) {
      suffixes.add(serializeExactOptimizerPartialStateSuffix({ memberCardIds: suffix }));
    }
  }
  return Object.freeze([...suffixes].sort() as SerializedPartialStateSuffix[]);
}

function assertBinary64Enclosure(value: unknown, label: string): void {
  assertRecord(value, label);
  assertBinary64Bits(value.lower, `${label}.lower`);
  assertBinary64Bits(value.upper, `${label}.upper`);
}

function validatePartialState(state: ExactOptimizerPartialState): ExactOptimizerPartialState {
  assertRecord(state, "Partial state");
  if (state.schemaVersion !== EXACT_OPTIMIZER_PARTIAL_STATE_SCHEMA_VERSION) {
    throw new Error("Unsupported partial-state schema version");
  }
  if (state.scope.manifestId !== EXACT_OPTIMIZER_REDUCED_SUFFIX_MANIFEST_ID ||
      state.scope.scopeHash !== EXACT_OPTIMIZER_REDUCED_SCOPE_HASH ||
      state.scope.seed !== EXACT_OPTIMIZER_REDUCED_SEED ||
      state.scope.boardSignature !== REDUCED_BOARD_SIGNATURE ||
      state.scope.investmentSignature !== REDUCED_INVESTMENT_SIGNATURE) {
    throw new Error("Partial state scope identity does not match the pinned reduced scope");
  }
  if (state.phase !== "formation-incomplete") {
    throw new Error("This state-only module accepts only pre-resolution states");
  }
  if (!Array.isArray(state.prefix.orderedMembers) || state.prefix.orderedMembers.length !== state.prefix.depth) {
    throw new Error("Partial state prefix depth does not match its ordered Members");
  }
  if (state.prefix.depth > 5 || state.prefix.selectedCount !== state.prefix.depth) {
    throw new Error("Partial state selected count is invalid");
  }
  assertBinary64Enclosure(state.arithmetic.lowerCentralUpperAccumulatorEnclosures.lower, "lower accumulator");
  assertBinary64Enclosure(state.arithmetic.lowerCentralUpperAccumulatorEnclosures.central, "central accumulator");
  assertBinary64Enclosure(state.arithmetic.lowerCentralUpperAccumulatorEnclosures.upper, "upper accumulator");
  return deepFreeze(state);
}

export function serializeExactOptimizerPartialState(
  state: ExactOptimizerPartialState,
): SerializedPartialState {
  const validated = validatePartialState(state);
  return canonicalize(canonicalJson(validated)) as SerializedPartialState;
}

export function parseExactOptimizerPartialState(
  serializedState: SerializedPartialState,
): ExactOptimizerPartialState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedState);
  } catch {
    throw new Error("Serialized partial state is not valid JSON");
  }
  if (canonicalize(canonicalJson(parsed)) !== serializedState) {
    throw new Error("Serialized partial state is not canonical");
  }
  return validatePartialState(parsed as ExactOptimizerPartialState);
}

/** The canonical-byte relation from the design document. */
export function canonicalExactOptimizerPartialStateKey(
  state: ExactOptimizerPartialState | SerializedPartialState,
): string {
  if (typeof state === "string") {
    parseExactOptimizerPartialState(state);
    return state;
  }
  return serializeExactOptimizerPartialState(state);
}

export function canonicalExactOptimizerPartialStateBytes(
  state: ExactOptimizerPartialState | SerializedPartialState,
): Uint8Array {
  return new TextEncoder().encode(canonicalExactOptimizerPartialStateKey(state));
}

/**
 * Resume only from serialized pre-resolution state. The suffix is decoded into
 * scalar card IDs and the new state is rebuilt from the pinned catalog. No
 * FormationInput, ExactOptimizerTeam, original Member object, or evaluator
 * entry point crosses this boundary.
 */
let cachedLegalSetKeys: ReadonlySet<string> | null = null;

function legalSetKeys(): ReadonlySet<string> {
  if (!cachedLegalSetKeys) {
    cachedLegalSetKeys = new Set(
      enumerateReducedLegalMemberSets().map((team) => [...team].sort().join("|")),
    );
  }
  return cachedLegalSetKeys;
}

export function resumeExactOptimizerSuffix(
  serializedState: SerializedPartialState,
  serializedSuffix: SerializedPartialStateSuffix,
): PartialStateResumeResult {
  const state = parseExactOptimizerPartialState(serializedState);
  if (state.arithmetic.status !== "not-started") {
    throw new Error("State-only resumption cannot continue a started accumulator");
  }
  const suffix = parseSuffix(serializedSuffix);
  const remaining = new Set(state.prefix.remainingActionIds);
  if (
    suffix.memberCardIds.length !== 5 - state.prefix.depth ||
    !suffix.memberCardIds.every((cardId) => remaining.has(cardId))
  ) {
    throw new Error("Suffix is not a legal completion of the serialized partial state");
  }
  const completedKey = [
    ...state.prefix.orderedMembers.map((member) => member.cardId),
    ...suffix.memberCardIds,
  ].sort().join("|");
  if (!legalSetKeys().has(completedKey)) {
    throw new Error("Suffix is not a legal completion of the serialized partial state");
  }
  const nextState = buildState({
    leaderOutfitCardId: state.fixedLeader.cardId,
    orderedMemberCardIds: [
      ...state.prefix.orderedMembers.map((member) => member.cardId),
      ...suffix.memberCardIds,
    ],
  });
  const completion = nextState.formationStatus === "prefix"
    ? "incomplete"
    : "complete-awaiting-fixed-leader-resolution";
  return Object.freeze({
    state: nextState,
    serializedState: serializeExactOptimizerPartialState(nextState),
    completion,
  });
}
