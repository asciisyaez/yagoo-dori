import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import {
  certifyCanonicalMicroUnitEnclosure,
  outwardBinary64DividePositive,
} from "../packages/core/src/exact-optimizer-bulk-accumulation.ts";
import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";
import {
  EXACT_OPTIMIZER_REDUCED_CHART_HASH,
  EXACT_OPTIMIZER_REDUCED_CHART_KEY,
  EXACT_OPTIMIZER_REDUCED_SCOPE_HASH,
  EXACT_OPTIMIZER_REDUCED_SEED,
  canonicalExactOptimizerPartialStateBytes,
  canonicalExactOptimizerPartialStateKey,
  createExactOptimizerPartialState,
  decodeBinary64,
  encodeBinary64,
  enumerateExactOptimizerLegalSuffixes,
  enumerateReducedLegalMemberSets,
  exactOptimizerPartialStateCatalog,
  resumeExactOptimizerAccumulatorRuns,
  resumeExactOptimizerSuffix,
  serializeExactOptimizerAccumulatorCheckpoint,
  serializeExactOptimizerAccumulatorLedger,
  serializeExactOptimizerPartialState,
} from "../packages/core/src/exact-optimizer-partial-state.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import {
  evaluateNativeRelativeUtilityWithActiveRunLedger,
} from "../packages/core/src/native-utility.ts";
import { songContextData } from "../packages/core/src/song-contexts.ts";

const ROOT = process.cwd();
const OUTPUT_PATH = "data/native/exact-optimizer-suffix-validation-v1.json";
const REPORT_ID = "yd-exact-optimizer-suffix-validation-v1";
const RUNNER_VERSION = "yd-exact-optimizer-suffix-validation-runner-1.0.0";
const MAX_REPORTED_MISMATCHES = 20;

const MANIFEST = {
  manifestId: "yd-exact-optimizer-reduced-suffix-v1",
  schemaVersion: 1,
  // Outcome-neutral: this block pins inputs; execution/passed carry outcome.
  status: "pinned",
  sourceScope: {
    path: "data/native/exact-optimizer-scope-v1.json",
    fileSha256: "c8f5999a40e0c832686309cf781672636f7222389f0a5f97180eb6ab88265683",
    scopeHash: "a53303691e95a289259b645b196ec3bea96fdc2609a6f527967d17fdc02e1871",
  },
  roster: {
    memberPool: [
      "card-00001-4-cmmn-0000-00",
      "card-00004-5-uniq-0005-00",
      "card-00005-5-uniq-0006-00",
      "card-00013-4-cmmn-0000-00",
      "card-00016-5-uniq-0014-00",
      "card-00018-5-uniq-0004-00",
      "card-00019-5-uniq-0016-00",
      "card-00039-5-uniq-0032-00",
    ],
    leaderOutfitIds: [
      "card-00001-5-uniq-0000-00",
      "card-00013-5-uniq-0002-00",
      "card-00019-5-uniq-0016-00",
      "card-00039-5-uniq-0032-00",
    ],
    legalMemberSetCount: 56,
    legalMemberSetRule:
      "combinations(memberPool, 5), retaining unique talentId and at most five rarity-5 Members, with each set sorted by cardId",
    orderedFormationPolicy: "all 120 permutations of each legal unordered set",
    caseCountInExistingSortedFixture: 224,
  },
  chart: {
    chartKeys: ["m0206:expert"],
    expectedChartHash: "9b1d3743fceb9be12e4a2c4905904f7c",
    weighting: "one chart, weight 1",
    difficulty: "expert",
  },
  investmentAndBloom: {
    memberInvestmentLayer: "one-copy-maximum",
    memberBloomStageByCardId: {
      "card-00001-4-cmmn-0000-00": 0,
      "card-00004-5-uniq-0005-00": 0,
      "card-00005-5-uniq-0006-00": 0,
      "card-00013-4-cmmn-0000-00": 0,
      "card-00016-5-uniq-0014-00": 0,
      "card-00018-5-uniq-0004-00": 0,
      "card-00019-5-uniq-0016-00": 0,
      "card-00039-5-uniq-0032-00": 0,
    },
    leaderInvestmentArgument:
      "none; Leader/Outfit is identified only by leaderCardId in the existing fixture",
    duplicateOnlyBoosts: false,
  },
  board: {
    stateId: "declared-neutral-board-v1",
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:exact-reduced-bruteforce",
    collectionBonus: "neutral-fixed",
    connectEffects: "neutral-fixed",
  },
  arithmetic: {
    seed: 1497450319,
    evaluator: "yd-native-utility-1.0.0",
    arithmetic: "yd-canonical-micro-units-1.0.0",
    memberOrderForTieKey: "sorted-card-ids",
    accumulation: "ordered IEEE-754 binary64 with outward enclosures",
    centralBulkGuard: "computed lower <= central <= upper per certified run; violation replays ordered",
  },
  sourceHashes: {
    reducedRosterScript: {
      path: "scripts/run-exact-reduced-bruteforce.mjs",
      sha256: "44084189cc88930566173e1f2c8d7302c523a385059b0fd943a671bd4ea31945",
    },
    parityIr: {
      path: "data/native/exact-optimizer-parity-ir-v1.json",
      fileSha256: "9e856c8b9c981fe66e6b9401e14d18623cf95a331d213acb13c936ad597d2f7c",
      irHash: "04d20828c5c2f11624db23a1068e07f47243d0b75db34842fe28d84c73d59074",
    },
    publicRoster: {
      path: "data/generated/holodori-public.json",
      sha256: "6705cc7e05c9e63fdd5e12a9fb0b8273f09de910d2e1390fb70ae41daa7858e4",
    },
    mechanics: {
      path: "data/generated/holodori-mechanics.json",
      sha256: "a181516762b8bbc2900082671c3eb3a339f9939cd7b66f71ec7dc6e22d0645c6",
    },
    songs: {
      path: "data/generated/holodori-songs.json",
      sha256: "45a3d3c88c11fc365888abc3f11e80efd8bc1d8298aae879cab7a100cae87711",
    },
    benchmark: {
      path: "data/native/ranking-benchmark-v1.json",
      sha256: "46ffad14b1376bf75d5b54fb7accd8e205c5d0b48fb7f94efb82b77c6d0aef6f",
    },
    timelineProjection: {
      path: "data/generated/holodori-ranking-corpus-timelines.json",
      sha256: "8f08b78d4af766feb5afc4039cdccf32defb6a295ffcadb7a9763ec8473aab3b",
    },
    timelineSourceManifest: {
      path: "data/native/chart-timeline-source.json",
      sha256: "b5bfc61f546a6f06ea26e82896d614c4feee849e27b6c5ecbca91f8cfa0e77f9",
    },
    fullTimeline: {
      path: "data/generated/holodori-chart-timelines.json",
      sha256: "196c49c4825f4699316f88015ef554173e47af04072211fa46ef143b6aa11474",
    },
  },
  certificateState: {
    certificateEligible: false,
    fullRunAuthorized: false,
    dominancePilot: "not-in-scope",
  },
};

const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = limitArgument === undefined
  ? null
  : Number.parseInt(limitArgument.slice("--limit=".length), 10);
if (limit !== null && (!Number.isSafeInteger(limit) || limit <= 0)) {
  throw new Error("--limit must be a positive safe integer");
}

// This matches the evidence scripts' digest convention: object undefined
// values are omitted, while undefined array entries serialize as null.
function canonicalize(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function sha256File(relativePath) {
  return createHash("sha256").update(readFileSync(join(ROOT, relativePath))).digest("hex");
}

function equalCanonical(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function assertEqual(label, actual, expected) {
  if (!equalCanonical(actual, expected)) {
    throw new Error(`${label} mismatch\nexpected: ${canonicalize(expected)}\nactual: ${canonicalize(actual)}`);
  }
}

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)])
      .map((rest) => [value, ...rest]),
  );
}

function factorial(value) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function decodeBits(bits) {
  return decodeBinary64(bits);
}

function encodedPoint(value) {
  const bits = encodeBinary64(value);
  return { lower: bits, upper: bits };
}

function emptyCheckpoint(passName) {
  const zero = encodedPoint(0);
  return serializeExactOptimizerAccumulatorCheckpoint({
    schemaVersion: 1,
    passName,
    runCursor: 0,
    noteCursor: 0,
    enclosures: { lower: zero, central: zero, upper: zero },
    fallbackReasons: [],
  });
}

function verifyPinnedInputs() {
  for (const [name, source] of Object.entries(MANIFEST.sourceHashes)) {
    const actual = sha256File(source.path);
    assertEqual(`Pinned source hash ${name}`, actual, source.sha256 ?? source.fileSha256);
  }
  assertEqual("Pinned source scope hash", sha256File(MANIFEST.sourceScope.path), MANIFEST.sourceScope.fileSha256);
  assertEqual("Exact scope hash", exactOptimizerScope.scopeHash, MANIFEST.sourceScope.scopeHash);
  assertEqual("Exact scope seed", exactOptimizerScope.seed, MANIFEST.arithmetic.seed);
  assertEqual("Partial-state scope hash", EXACT_OPTIMIZER_REDUCED_SCOPE_HASH, MANIFEST.sourceScope.scopeHash);
  assertEqual("Partial-state seed", EXACT_OPTIMIZER_REDUCED_SEED, MANIFEST.arithmetic.seed);
  assertEqual("Partial-state chart key", EXACT_OPTIMIZER_REDUCED_CHART_KEY, MANIFEST.chart.chartKeys[0]);
  assertEqual("Partial-state chart hash", EXACT_OPTIMIZER_REDUCED_CHART_HASH, MANIFEST.chart.expectedChartHash);
  assertEqual("Reduced account board mode", exactOptimizerScope.account.board.mode, MANIFEST.board.mode);
  assertEqual("Reduced account board evidence grade", exactOptimizerScope.account.board.evidenceGrade, MANIFEST.board.evidenceGrade);
  assertEqual("Reduced account state ID", exactOptimizerScope.account.stateId, MANIFEST.board.stateId);
  const chart = songContextData.charts.find((candidate) => candidate.key === MANIFEST.chart.chartKeys[0]);
  if (!chart) throw new Error("Pinned reduced chart is missing");
  assertEqual("Pinned chart hash", chart.chartHash, MANIFEST.chart.expectedChartHash);
  const legalSets = enumerateReducedLegalMemberSets();
  assertEqual("Pinned legal set count", legalSets.length, MANIFEST.roster.legalMemberSetCount);
  assertEqual(
    "Pinned reduced member pool",
    [...new Set(legalSets.flat())].sort(),
    [...MANIFEST.roster.memberPool].sort(),
  );
  assertEqual(
    "Pinned reduced Leaders",
    [...exactOptimizerPartialStateCatalog.leaderOutfitCardIds].sort(),
    [...MANIFEST.roster.leaderOutfitIds].sort(),
  );
  return legalSets.map((team) => [...team]);
}

function buildPrefixRecords(legalSets, leaders) {
  const recordsByKey = new Map();
  for (const leaderOutfitCardId of leaders) {
    for (const memberSet of legalSets) {
      for (const order of permutations(memberSet)) {
        for (let depth = 0; depth <= 5; depth += 1) {
          const orderedMemberCardIds = order.slice(0, depth);
          const historyKey = `${leaderOutfitCardId}|${orderedMemberCardIds.join("|")}`;
          if (recordsByKey.has(historyKey)) continue;
          const serialized = serializeExactOptimizerPartialState(
            createExactOptimizerPartialState({ leaderOutfitCardId, orderedMemberCardIds }),
          );
          recordsByKey.set(historyKey, {
            historyKey,
            key: canonicalExactOptimizerPartialStateKey(serialized),
            serialized,
            leaderOutfitCardId,
            orderedMemberCardIds,
          });
        }
      }
    }
  }
  return [...recordsByKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function projectedPrefixAndSuffixCounts(legalSets) {
  const prefixesByDepth = Array.from({ length: 6 }, () => new Set());
  for (const memberSet of legalSets) {
    for (const order of permutations(memberSet)) {
      for (let depth = 0; depth <= 5; depth += 1) {
        prefixesByDepth[depth].add(order.slice(0, depth).join("|"));
      }
    }
  }
  let suffixes = 0;
  for (let depth = 0; depth <= 5; depth += 1) {
    for (const prefixKey of prefixesByDepth[depth]) {
      const prefix = prefixKey === "" ? [] : prefixKey.split("|");
      suffixes += legalSets
        .filter((memberSet) => prefix.every((cardId) => memberSet.includes(cardId)))
        .length * factorial(5 - depth);
    }
  }
  return {
    prefixStatesPerLeader: prefixesByDepth.map((entries) => entries.size),
    prefixStates: prefixesByDepth.reduce((total, entries) => total + entries.size, 0),
    suffixesPerLeader: suffixes,
  };
}

function mutationSpecs(state) {
  const hasMember = state.prefix.orderedMembers.length > 0;
  return [
    { label: "remaining action set", mutate: (value) => value.prefix.remainingActionIds.splice(0, 1), applies: true },
    { label: "selected count", mutate: (value) => { value.prefix.selectedCount += 1; }, applies: true },
    { label: "five-star budget", mutate: (value) => { value.prefix.remainingFiveStarBudget += 1; }, applies: true },
    { label: "Leader/card identity", mutate: (value) => { value.fixedLeader.talentId = "mutated-talent"; }, applies: true },
    { label: "investment signature", mutate: (value) => { value.scope.investmentSignature = "mutated-investment"; }, applies: true },
    { label: "Bloom stage", mutate: (value) => { value.prefix.orderedMembers[0].bloomStage = 1; }, applies: hasMember },
    { label: "attribute/group counts", mutate: (value) => { value.prefix.attributeCounts.cute += 1; }, applies: true },
    { label: "Leader trigger truth", mutate: (value) => { value.leaderAndTriggerFacts.reason = "mutated-trigger"; }, applies: true },
    { label: "capped-target eligibility", mutate: (value) => { value.leaderAndTriggerFacts.reason = "mutated-target"; }, applies: true },
    { label: "chart key", mutate: (value) => { delete value.chartContext.chartKey; }, applies: true },
    { label: "chart hash", mutate: (value) => { delete value.chartContext.expectedChartHash; }, applies: true },
    { label: "singer/order signature", mutate: (value) => { value.chartContext.chartOrderSignature = "mutated-order"; }, applies: true },
    { label: "Member parameters", mutate: (value) => { value.memberFacts.progressionStateAndParametersBySlot[0].parameters.performance += 1; }, applies: hasMember },
    { label: "Active timing/probability", mutate: (value) => { value.memberFacts.activeTimingBySlot[0].cooldownMilliseconds = 1; }, applies: hasMember },
    { label: "persistent support", mutate: (value) => { value.memberFacts.activeValueAndProbabilityLedger.reason = "mutated-support"; }, applies: true },
    { label: "Special support/activation", mutate: (value) => { value.specialFacts.reason = "mutated-special"; }, applies: true },
    { label: "ordered accumulator cursor", mutate: (value) => { value.arithmetic.cursor.noteIndex += 1; }, applies: true },
    { label: "tie/finalist continuation", mutate: (value) => { value.comparison.prefixTieKey = "mutated-tie"; }, applies: true },
  ];
}

function runMutationChecks(prefixRecords, mismatches) {
  let attempted = 0;
  let passed = 0;
  const labels = {};
  for (const record of prefixRecords) {
    for (const spec of mutationSpecs(JSON.parse(record.serialized))) {
      if (!spec.applies) continue;
      attempted += 1;
      labels[spec.label] = (labels[spec.label] ?? 0) + 1;
      const mutated = JSON.parse(record.serialized);
      spec.mutate(mutated);
      let diverged = false;
      try {
        diverged = canonicalExactOptimizerPartialStateKey(mutated) !== record.key;
      } catch {
        diverged = true;
      }
      if (diverged) passed += 1;
      else mismatches.add("mutation", { historyKey: record.historyKey, dimension: spec.label });
    }
  }
  return { attempted, passed, labels };
}

function addRunLedgerMismatch(mismatches, context, expected, actual) {
  mismatches.add("accumulator-continuation", {
    context,
    expected,
    actual,
  });
}

function compareAccumulatorResults(uninterrupted, continued, context, mismatches) {
  if (!equalCanonical(uninterrupted.enclosures, continued.enclosures)) {
    addRunLedgerMismatch(mismatches, context, uninterrupted.enclosures, continued.enclosures);
  }
  if (!equalCanonical(uninterrupted.canonical, continued.canonical)) {
    addRunLedgerMismatch(mismatches, `${context}:canonical`, uninterrupted.canonical, continued.canonical);
  }
  if (uninterrupted.serializedCheckpoint !== continued.serializedCheckpoint) {
    addRunLedgerMismatch(
      mismatches,
      `${context}:checkpoint`,
      uninterrupted.serializedCheckpoint,
      continued.serializedCheckpoint,
    );
  }
}

function runAccumulatorValidation(evaluation, context, mismatches, counts) {
  const ledger = evaluation.activeRunLedger;
  const passResults = [];
  for (const pass of ledger.passes) {
    const runs = pass.runs.map((run, runIndex) => ({
      passName: pass.passName,
      runIndex,
      noteIndex: run.startInclusive,
      multiplicity: run.multiplicity,
      contributions: run.contributions,
      expectedContributions: run.expectedContributions,
    }));
    const initial = emptyCheckpoint(pass.passName);
    const fullLedger = serializeExactOptimizerAccumulatorLedger({
      schemaVersion: 1,
      passName: pass.passName,
      runs,
    });
    const uninterrupted = resumeExactOptimizerAccumulatorRuns(initial, fullLedger);
    let checkpoint = initial;
    for (let boundary = 0; boundary <= runs.length; boundary += 1) {
      const tailLedger = serializeExactOptimizerAccumulatorLedger({
        schemaVersion: 1,
        passName: pass.passName,
        runs: runs.slice(boundary),
      });
      const continued = resumeExactOptimizerAccumulatorRuns(checkpoint, tailLedger);
      counts.accumulatorBoundaryComparisons += 1;
      compareAccumulatorResults(
        uninterrupted,
        continued,
        `${context}|${pass.passName}|boundary:${boundary}`,
        mismatches,
      );
      if (boundary < runs.length) {
        const oneRunLedger = serializeExactOptimizerAccumulatorLedger({
          schemaVersion: 1,
          passName: pass.passName,
          runs: [runs[boundary]],
        });
        checkpoint = resumeExactOptimizerAccumulatorRuns(checkpoint, oneRunLedger).serializedCheckpoint;
      }
    }
    counts.accumulatorPasses += 1;
    counts.accumulatorRuns += runs.length;
    passResults.push({ pass, uninterrupted });
  }

  const recorded = ledger.recordedAveragePermil;
  if (!recorded) throw new Error("Active run ledger omitted recorded average values");
  const recordedByPass = [recorded.base, recorded.specialSupport, recorded.specialActivation];
  for (let passIndex = 0; passIndex < passResults.length; passIndex += 1) {
    const { uninterrupted } = passResults[passIndex];
    const expectedAverage = recordedByPass[passIndex];
    for (const lane of ["lower", "central", "upper"]) {
      const divided = outwardBinary64DividePositive(
        {
          lower: decodeBits(uninterrupted.enclosures[lane].lower),
          upper: decodeBits(uninterrupted.enclosures[lane].upper),
        },
        ledger.noteCount,
      );
      if (!divided) {
        counts.referenceAverageNotComparable += 1;
        continue;
      }
      const certified = certifyCanonicalMicroUnitEnclosure(divided);
      if (certified.kind === "ordered-replay-required") {
        counts.referenceAverageNotComparable += 1;
        continue;
      }
      counts.referenceAverageComparisons += 1;
      const expectedMicroUnits = toCanonicalMicroUnits(decodeBits(expectedAverage[lane]));
      if (certified.canonicalMicroUnits !== expectedMicroUnits) {
        mismatches.add("accumulator-reference", {
          context,
          passName: passResults[passIndex].pass.passName,
          lane,
          expectedMicroUnits,
          actualMicroUnits: certified.canonicalMicroUnits,
        });
      }
    }
  }

  const referenceBase = evaluation.result.components.active.averageEffectiveUpPermil;
  for (const lane of ["lower", "central", "upper"]) {
    counts.referenceRecordedValueComparisons += 1;
    if (!Object.is(decodeBits(recorded.base[lane]), referenceBase[lane])) {
      mismatches.add("instrumentation-reference", {
        context,
        lane,
        expectedBits: encodeBinary64(referenceBase[lane]),
        actualBits: recorded.base[lane],
      });
    }
  }
}

function runStateSuffixValidation(prefixRecords, mismatches, counts) {
  const suffixCache = new Map();
  const fullStateCache = new Map();
  for (const record of prefixRecords) {
    let suffixes = suffixCache.get(record.serialized);
    if (!suffixes) {
      suffixes = enumerateExactOptimizerLegalSuffixes(record.serialized);
      suffixCache.set(record.serialized, suffixes);
    }
    counts.legalSuffixes += suffixes.length;
    for (const serializedSuffix of suffixes) {
      const suffix = JSON.parse(serializedSuffix).memberCardIds;
      const fullMemberCardIds = [...record.orderedMemberCardIds, ...suffix];
      const fullHistoryKey = `${record.leaderOutfitCardId}|${fullMemberCardIds.join("|")}`;
      let fromScratch = fullStateCache.get(fullHistoryKey);
      if (!fromScratch) {
        fromScratch = serializeExactOptimizerPartialState(
          createExactOptimizerPartialState({
            leaderOutfitCardId: record.leaderOutfitCardId,
            orderedMemberCardIds: fullMemberCardIds,
          }),
        );
        fullStateCache.set(fullHistoryKey, fromScratch);
      }
      const resumed = resumeExactOptimizerSuffix(record.serialized, serializedSuffix);
      counts.resumeBoundaryComparisons += 1;
      if (resumed.serializedState !== fromScratch ||
          !Buffer.from(canonicalExactOptimizerPartialStateBytes(resumed.serializedState))
            .equals(Buffer.from(canonicalExactOptimizerPartialStateBytes(fromScratch)))) {
        mismatches.add("state-resumption", {
          prefixHistory: record.historyKey,
          suffix: serializedSuffix,
          expected: fromScratch,
          actual: resumed.serializedState,
        });
      }
      counts.finalComparisons += 1;
    }
  }
}

function makeNativeInput(leaderOutfitCardId, orderedMemberCardIds) {
  return {
    formation: {
      leaderOutfitCardId,
      members: orderedMemberCardIds.map((cardId) => ({
        cardId,
        investment: MANIFEST.investmentAndBloom.memberInvestmentLayer,
        bloomStage: 0,
      })),
    },
    chartKey: MANIFEST.chart.chartKeys[0],
    seed: MANIFEST.arithmetic.seed,
    accountState: {
      board: {
        mode: MANIFEST.board.mode,
        evidenceGrade: MANIFEST.board.evidenceGrade,
        evidenceRef: MANIFEST.board.evidenceRef,
      },
    },
  };
}

function runRealAccumulatorValidation(orders, leaders, mismatches, counts) {
  for (const leaderOutfitCardId of leaders) {
    for (const orderedMemberCardIds of orders) {
      const context = `${leaderOutfitCardId}|${orderedMemberCardIds.join("|")}`;
      const evaluation = evaluateNativeRelativeUtilityWithActiveRunLedger(
        makeNativeInput(leaderOutfitCardId, orderedMemberCardIds),
      );
      counts.realAccumulatorFormationCases += 1;
      runAccumulatorValidation(evaluation, context, mismatches, counts);
    }
  }
}

function main() {
  const started = performance.now();
  const allLegalSets = verifyPinnedInputs();
  const selectedLegalSets = limit === null ? allLegalSets : allLegalSets.slice(0, limit);
  const leaders = [...MANIFEST.roster.leaderOutfitIds];
  const orders = selectedLegalSets.flatMap((memberSet) => permutations(memberSet));
  const prefixRecords = buildPrefixRecords(selectedLegalSets, leaders);
  const projected = projectedPrefixAndSuffixCounts(allLegalSets);
  const selectedSuffixProjection = {
    prefixStatesPerLeader: projectedPrefixAndSuffixCounts(selectedLegalSets).prefixStatesPerLeader,
    prefixStates: prefixRecords.length,
  };
  const workPlan = {
    memberSets: selectedLegalSets.length,
    leaders: leaders.length,
    charts: MANIFEST.chart.chartKeys.length,
    formationOrders: orders.length,
    prefixDepths: 6,
    prefixStates: prefixRecords.length,
    legalSuffixes: prefixRecords.reduce((total, record) =>
      total + enumerateExactOptimizerLegalSuffixes(record.serialized).length, 0),
    realAccumulatorFormationCases: orders.length * leaders.length,
    projectedFull: {
      memberSets: MANIFEST.roster.legalMemberSetCount,
      formationOrders: MANIFEST.roster.legalMemberSetCount * factorial(5),
      prefixStates: projected.prefixStates * leaders.length,
      legalSuffixes: projected.suffixesPerLeader * leaders.length,
      realAccumulatorFormationCases: MANIFEST.roster.legalMemberSetCount * factorial(5) * leaders.length,
    },
  };
  process.stdout.write(`Suffix validation work plan before comparisons:\n${JSON.stringify({ workPlan, selectedSuffixProjection }, null, 2)}\n`);

  const mismatchByKind = {};
  const firstCounterexamples = [];
  const mismatches = {
    add(kind, detail) {
      mismatchByKind[kind] = (mismatchByKind[kind] ?? 0) + 1;
      if (firstCounterexamples.length < MAX_REPORTED_MISMATCHES) {
        firstCounterexamples.push({ kind, detail });
      }
    },
  };
  const counts = {
    memberSetsEnumerated: selectedLegalSets.length,
    formationOrdersEnumerated: orders.length,
    prefixStatesEnumerated: prefixRecords.length,
    legalSuffixes: 0,
    resumeBoundaryComparisons: 0,
    finalComparisons: 0,
    realAccumulatorFormationCases: 0,
    accumulatorPasses: 0,
    accumulatorRuns: 0,
    accumulatorBoundaryComparisons: 0,
    referenceAverageComparisons: 0,
    referenceAverageNotComparable: 0,
    referenceRecordedValueComparisons: 0,
    collisionPairs: 0,
    distinctHistoryKeys: 0,
    mutationChecks: 0,
    mutationPassed: 0,
  };

  const mutation = runMutationChecks(prefixRecords, mismatches);
  counts.mutationChecks = mutation.attempted;
  counts.mutationPassed = mutation.passed;
  runStateSuffixValidation(prefixRecords, mismatches, counts);

  const stateKeyHistories = new Map();
  for (const record of prefixRecords) {
    const histories = stateKeyHistories.get(record.key) ?? new Set();
    histories.add(record.historyKey);
    stateKeyHistories.set(record.key, histories);
  }
  counts.distinctHistoryKeys = [...stateKeyHistories.values()]
    .reduce((total, histories) => total + histories.size, 0);
  for (const histories of stateKeyHistories.values()) {
    counts.collisionPairs += (histories.size * (histories.size - 1)) / 2;
  }
  runRealAccumulatorValidation(orders, leaders, mismatches, counts);

  const totalMismatches = Object.values(mismatchByKind).reduce((total, count) => total + count, 0);
  const fullScopeEnumerated = limit === null;
  const deterministicReport = {
    schemaVersion: 1,
    reportId: REPORT_ID,
    runnerVersion: RUNNER_VERSION,
    manifest: MANIFEST,
    execution: {
      scopeMode: fullScopeEnumerated ? "full" : "smoke-limited",
      limit,
      fullScopeEnumerated,
    },
    workPlan,
    counts,
    mutationChecks: mutation,
    collisionResult: {
      collisionPairs: counts.collisionPairs,
      disposition: counts.collisionPairs === 0 ? "no merge rule exercised" : "distinct-history merges exercised",
    },
    mismatches: {
      total: totalMismatches,
      byKind: mismatchByKind,
      firstCounterexamples,
    },
    zeroMismatch: totalMismatches === 0,
    passed: fullScopeEnumerated && totalMismatches === 0,
    certificateEligible: false,
    fullRunAuthorized: false,
    disposition: fullScopeEnumerated
      ? "Reduced-scope suffix and accumulator continuation validation completed; this does not prove full-roster dominance, a certificate, or performance credit."
      : "Smoke-limited reduced-scope suffix and accumulator continuation validation; full enumeration remains unexecuted and earns no certification or performance credit.",
  };
  const report = {
    ...deterministicReport,
    deterministicDigest: sha256(deterministicReport),
    runtimeMetadata: {
      generatedAt: new Date().toISOString(),
      elapsedMilliseconds: Math.round((performance.now() - started) * 1000) / 1000,
      rssBytes: process.memoryUsage().rss,
    },
  };
  writeFileSync(join(ROOT, OUTPUT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    outputPath: OUTPUT_PATH,
    deterministicDigest: report.deterministicDigest,
    counts,
    zeroMismatch: report.zeroMismatch,
    passed: report.passed,
    runtimeMetadata: report.runtimeMetadata,
  }, null, 2)}\n`);
  if (!report.zeroMismatch) process.exitCode = 1;
}

main();
