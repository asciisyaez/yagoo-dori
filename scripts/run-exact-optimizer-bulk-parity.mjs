import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import {
  replayOrderedRepeatedBinary64Addition,
  certifyCanonicalMicroUnitEnclosure,
  nextDown,
  nextUp,
  pointBinary64Enclosure,
  transformRepeatedBinary64Addition,
} from "../packages/core/src/exact-optimizer-bulk-accumulation.ts";
import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";
import {
  compileExactOptimizerTeam,
  evaluateExactOptimizerTeamLeader,
  evaluateExactOptimizerTeamLeaderCentral,
} from "../packages/core/src/exact-optimizer-kernel.ts";
import {
  evaluateNativeRelativeUtilityUncompressed,
  evaluateNativeRelativeUtilityWithOrderedStateRuns,
} from "../packages/core/src/native-utility.ts";

const ROOT = process.cwd();
const SAMPLE_PATH = "data/native/exact-optimizer-parity-sample-v1.json";
const SCOPE_PATH = "data/native/exact-optimizer-scope-v1.json";
const OUTPUT_PATH = "data/native/exact-optimizer-bulk-parity-v1.json";
const SYNTHETIC_CASE_COUNT = 1_000_000;
const MAX_REPORTED_MISMATCHES = 20;
const REPORT_ID = "yd-exact-optimizer-bulk-parity-v1";
const RUNNER_VERSION = "yd-exact-optimizer-bulk-parity-runner-1.0.0";

const args = new Set(process.argv.slice(2));
const syntheticOnly = args.has("--synthetic-only");
const realOnly = args.has("--real-only");
const skipRust = args.has("--skip-rust");
const rehashExisting = args.has("--rehash-existing");
const realLimitArgument = [...args].find((argument) => argument.startsWith("--real-limit="));
const realLimit = realLimitArgument === undefined
  ? null
  : Number.parseInt(realLimitArgument.slice("--real-limit=".length), 10);
if (syntheticOnly && realOnly) throw new Error("--synthetic-only and --real-only cannot be combined");
if (rehashExisting && (syntheticOnly || realOnly || skipRust || realLimit !== null)) {
  throw new Error("--rehash-existing cannot be combined with corpus execution flags");
}
if (realLimit !== null && (!Number.isSafeInteger(realLimit) || realLimit <= 0)) {
  throw new Error("--real-limit must be a positive safe integer");
}

// Must serialize exactly what JSON.stringify writes to the artifact file:
// undefined object values are dropped and undefined array items become null,
// otherwise the recorded digest is not reproducible from the file bytes.
function canonicalize(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

/**
 * The evidence digest intentionally excludes all host/runtime observations.
 * A prior duplicate full run proved that elapsed measurements change while the
 * pinned corpus, result digests, counters, fallbacks, and mismatch counts do
 * not.  It is the only parity hash downstream certification evidence may use.
 */
function evidenceDigestInput(report) {
  const synthetic = report.synthetic === null ? null : {
    methodologyVersion: report.synthetic.methodologyVersion,
    caseCount: report.synthetic.caseCount,
    referenceRecurrence: report.synthetic.referenceRecurrence,
    referenceSteps: report.synthetic.referenceSteps,
    categories: report.synthetic.categories,
    expectedFallbackReasons: report.synthetic.expectedFallbackReasons,
    observedTransformFallbackReasons: report.synthetic.observedTransformFallbackReasons,
    observedCanonicalFallbackReasons: report.synthetic.observedCanonicalFallbackReasons,
    supportedRuns: report.synthetic.supportedRuns,
    transformFallbacks: report.synthetic.transformFallbacks,
    canonicalCertificates: report.synthetic.canonicalCertificates,
    canonicalFallbacks: report.synthetic.canonicalFallbacks,
    containmentFailures: report.synthetic.containmentFailures,
    falseCertificates: report.synthetic.falseCertificates,
    expectedFallbackFailures: report.synthetic.expectedFallbackFailures,
    deterministicDigest: report.synthetic.deterministicDigest,
    passed: report.synthetic.passed,
  };
  const realCorpus = report.realCorpus === null ? null : {
    methodologyVersion: report.realCorpus.methodologyVersion,
    input: report.realCorpus.input,
    orderedRustReference: report.realCorpus.orderedRustReference?.status
      ? { status: report.realCorpus.orderedRustReference.status }
      : {
          outputCount: report.realCorpus.orderedRustReference.outputCount,
          outputCountMatchesFullCorpus: report.realCorpus.orderedRustReference.outputCountMatchesFullCorpus,
        },
    implementations: report.realCorpus.implementations,
    comparisonMismatches: report.realCorpus.comparisonMismatches,
    bulk: report.realCorpus.bulk,
    centralB2: report.realCorpus.centralB2,
    deterministicDigest: report.realCorpus.deterministicDigest,
    passed: report.realCorpus.passed,
  };
  return {
    schema: "yd-exact-optimizer-bulk-evidence-digest-1",
    reportId: report.reportId,
    runnerVersion: report.runnerVersion,
    synthetic,
    realCorpus,
    passed: report.passed,
    certificateEligible: report.certificateEligible,
    disposition: report.disposition,
  };
}

function stableEvidenceDigest(report) {
  return sha256(evidenceDigestInput(report));
}

function runtimeMetadata(report) {
  return {
    generatedAt: report.generatedAt,
    totalElapsedMilliseconds: report.elapsedMilliseconds,
    syntheticElapsedMilliseconds: report.synthetic?.elapsedMilliseconds ?? null,
    orderedRustElapsedMilliseconds: report.realCorpus?.orderedRustReference?.elapsedMilliseconds ?? null,
    realCorpusTiming: report.realCorpus?.timing ?? null,
  };
}

function sha256File(relativePath) {
  return createHash("sha256").update(readFileSync(join(ROOT, relativePath))).digest("hex");
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

function nativeCanonical(relativeUtility) {
  return {
    lower: toCanonicalMicroUnits(relativeUtility.lower),
    central: toCanonicalMicroUnits(relativeUtility.central),
    upper: toCanonicalMicroUnits(relativeUtility.upper),
  };
}

function tuplesEqual(left, right) {
  return left.lower === right.lower && left.central === right.central && left.upper === right.upper;
}

function addReason(counts, reason) {
  const key = reason ?? "none";
  counts[key] = (counts[key] ?? 0) + 1;
}

/** Fixed xorshift32 makes each synthetic case independently reproducible. */
function xorshift32(seed) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function powerOfTwo(exponent) {
  return 2 ** exponent;
}

function syntheticCase(index) {
  const lane = index % 32;
  const random = xorshift32(index ^ 0x9e3779b9);
  const random2 = xorshift32(random ^ 0x85ebca6b);
  const smallInteger = 1 + (random % 1_000_000);
  const multiplicity = 2 + (random2 % 31);
  const boundary = (smallInteger + (lane === 0 ? 0.499999 : lane === 1 ? 0.5 : 0.500001)) / 1_000_000;
  const exponent = -700 + (random % 1_450);
  const transitionExponent = -500 + (random % 1_000);
  const normal = powerOfTwo(exponent);
  const transition = powerOfTwo(transitionExponent);

  switch (lane) {
    // Math.round half-micro-unit neighborhood: the exact publication boundary.
    case 0:
    case 1:
    case 2:
      return { category: "canonical-half-micro-boundary", incoming: 0, contribution: boundary, multiplicity: 1 };
    // ULP transitions on both sides of an exact power of two.
    case 3:
      return {
        category: "ulp-transition-below-power-of-two",
        incoming: nextDown(transition),
        contribution: powerOfTwo(transitionExponent - 53),
        multiplicity,
      };
    case 4:
      return {
        category: "ulp-transition-at-power-of-two",
        incoming: transition,
        contribution: powerOfTwo(transitionExponent - 52),
        multiplicity,
      };
    case 5:
      return {
        category: "ulp-transition-above-power-of-two",
        incoming: nextUp(transition),
        contribution: powerOfTwo(transitionExponent - 52),
        multiplicity,
      };
    // Normal exponent sweep: covers every normal magnitude used by the model.
    case 6:
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
      return {
        category: "normal-exponent-sweep",
        incoming: powerOfTwo(Math.max(-1021, exponent)),
        contribution: normal,
        multiplicity,
      };
    case 12:
      return {
        category: "large-run-small-contribution",
        incoming: 1 + (random % 10_000) / 1_000,
        contribution: powerOfTwo(-52 - (random % 30)),
        multiplicity: 256 + (random2 % 512),
      };
    case 13:
      return {
        category: "zero-contribution",
        incoming: 1 + (random % 1_000),
        contribution: 0,
        multiplicity: 1 + (random2 % 4_096),
      };
    case 14:
      return {
        category: "minimum-normal-boundary",
        incoming: powerOfTwo(-1022),
        contribution: nextUp(powerOfTwo(-1022)),
        multiplicity: 1 + (random % 3),
      };
    case 15:
      return {
        category: "large-normal-boundary",
        incoming: powerOfTwo(900 + (random % 100)),
        contribution: powerOfTwo(840 + (random2 % 80)),
        multiplicity: 2 + (random % 5),
      };
    // Explicit precondition/fallback coverage. These never claim a certificate.
    case 16:
      return {
        category: "expected-subnormal-fallback",
        incoming: 0,
        contribution: Number.MIN_VALUE,
        multiplicity: 1,
        expectedFallback: "subnormal-assumption-not-proven",
      };
    case 17:
      return {
        category: "expected-signed-zero-fallback",
        incoming: -0,
        contribution: 1,
        multiplicity: 1,
        expectedFallback: "signed-zero-sensitive",
      };
    case 18:
      return {
        category: "expected-nonfinite-fallback",
        incoming: 0,
        contribution: Number.POSITIVE_INFINITY,
        multiplicity: 1,
        expectedFallback: "unsupported-nonfinite-value",
      };
    case 19:
      return {
        category: "expected-contribution-mismatch",
        incoming: 1,
        contribution: 0.125,
        expectedContribution: 0.25,
        multiplicity: 3,
        expectedFallback: "contribution-mismatch",
      };
    case 20:
      return {
        category: "expected-invalid-multiplicity",
        incoming: 1,
        contribution: 0.125,
        multiplicity: 0,
        expectedFallback: "invalid-multiplicity",
      };
    case 21:
      return {
        category: "expected-negative-path-fallback",
        incoming: 1,
        contribution: -0.125,
        multiplicity: 3,
        expectedFallback: "unsupported-operation-path",
      };
    // Repeating-binary fractions exercise source-order divergence from n*x.
    case 22:
    case 23:
    case 24:
      return {
        category: "repeating-binary-fraction",
        incoming: (random % 1_000) / 10,
        contribution: (1 + (random2 % 997)) / 997,
        multiplicity: 2 + (random % 64),
      };
    default:
      return {
        category: "mixed-normal-positive",
        incoming: (random % 1_000_000) / 10_000,
        contribution: (1 + (random2 % 100_000)) / 1_000_000,
        multiplicity,
      };
  }
}

function runSyntheticBoundaries() {
  const started = performance.now();
  const categories = {};
  const expectedFallbackReasons = {};
  const observedFallbackReasons = {};
  const canonicalFallbackReasons = {};
  const failures = [];
  const digest = createHash("sha256");
  let supportedRuns = 0;
  let transformFallbacks = 0;
  let canonicalCertificates = 0;
  let canonicalFallbacks = 0;
  let containmentFailures = 0;
  let falseCertificates = 0;
  let expectedFallbackFailures = 0;
  let referenceSteps = 0;

  for (let index = 0; index < SYNTHETIC_CASE_COUNT; index += 1) {
    const candidate = syntheticCase(index);
    categories[candidate.category] = (categories[candidate.category] ?? 0) + 1;
    if (candidate.expectedFallback) addReason(expectedFallbackReasons, candidate.expectedFallback);
    const transformed = transformRepeatedBinary64Addition({
      incoming: pointBinary64Enclosure(candidate.incoming),
      contribution: candidate.contribution,
      multiplicity: candidate.multiplicity,
      ...(candidate.expectedContribution === undefined
        ? {}
        : { expectedContribution: candidate.expectedContribution }),
    });
    if (transformed.kind === "ordered-replay-required") {
      transformFallbacks += 1;
      addReason(observedFallbackReasons, transformed.fallbackReason);
      if (candidate.expectedFallback && transformed.fallbackReason !== candidate.expectedFallback) {
        expectedFallbackFailures += 1;
        if (failures.length < MAX_REPORTED_MISMATCHES) {
          failures.push({ index, category: candidate.category, expectedFallback: candidate.expectedFallback, actualFallback: transformed.fallbackReason });
        }
      }
      digest.update(`${index}|${candidate.category}|fallback|${transformed.fallbackReason}\n`);
      continue;
    }
    supportedRuns += 1;
    if (candidate.expectedFallback) {
      expectedFallbackFailures += 1;
      if (failures.length < MAX_REPORTED_MISMATCHES) {
        failures.push({ index, category: candidate.category, expectedFallback: candidate.expectedFallback, actualFallback: null });
      }
    }
    const reference = replayOrderedRepeatedBinary64Addition(
      candidate.incoming,
      candidate.contribution,
      candidate.multiplicity,
    );
    referenceSteps += candidate.multiplicity;
    const contains = transformed.enclosure.lower <= reference && reference <= transformed.enclosure.upper;
    if (!contains) {
      containmentFailures += 1;
      if (failures.length < MAX_REPORTED_MISMATCHES) {
        failures.push({
          index,
          category: candidate.category,
          failure: "reference-not-contained",
          reference,
          enclosure: transformed.enclosure,
        });
      }
    }
    const canonical = certifyCanonicalMicroUnitEnclosure(transformed.enclosure);
    if (canonical.kind === "ordered-replay-required") {
      canonicalFallbacks += 1;
      addReason(canonicalFallbackReasons, canonical.fallbackReason);
      digest.update(`${index}|${candidate.category}|run|${canonical.fallbackReason}\n`);
      continue;
    }
    canonicalCertificates += 1;
    let referenceCanonical = null;
    try {
      referenceCanonical = toCanonicalMicroUnits(reference);
    } catch {
      // A non-canonicalizable reference can never support a certificate.
      falseCertificates += 1;
    }
    if (referenceCanonical !== canonical.canonicalMicroUnits) {
      falseCertificates += 1;
      if (failures.length < MAX_REPORTED_MISMATCHES) {
        failures.push({
          index,
          category: candidate.category,
          failure: "certificate-disagrees-with-ordered-reference",
          referenceCanonical,
          certifiedCanonical: canonical.canonicalMicroUnits,
          enclosure: transformed.enclosure,
        });
      }
    }
    digest.update(`${index}|${candidate.category}|certified|${canonical.canonicalMicroUnits}\n`);
  }
  return {
    methodologyVersion: RUNNER_VERSION,
    caseCount: SYNTHETIC_CASE_COUNT,
    referenceRecurrence: "s(i + 1) = RN-even-binary64(s(i) + x), evaluated in source order",
    referenceSteps,
    categories,
    expectedFallbackReasons,
    observedTransformFallbackReasons: observedFallbackReasons,
    observedCanonicalFallbackReasons: canonicalFallbackReasons,
    supportedRuns,
    transformFallbacks,
    canonicalCertificates,
    canonicalFallbacks,
    containmentFailures,
    falseCertificates,
    expectedFallbackFailures,
    firstFailures: failures,
    deterministicDigest: digest.digest("hex"),
    passed: containmentFailures === 0 && falseCertificates === 0 && expectedFallbackFailures === 0,
    elapsedMilliseconds: rounded(performance.now() - started),
  };
}

function runRustReference(samplePath) {
  const args = [
    "run",
    "--release",
    "--manifest-path",
    "tools/exact-global-solver/Cargo.toml",
    "--",
    "tools/exact-global-solver/kernel.json",
    samplePath,
  ];
  const started = performance.now();
  const result = spawnSync("cargo", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Rust ordered reference failed (${result.status}): ${result.stderr.trim()}`);
  }
  const entries = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  return {
    elapsedMilliseconds: rounded(performance.now() - started),
    entries: new Map(entries.map((entry) => [entry.caseId, entry])),
    outputCount: entries.length,
  };
}

function realCaseInput(caseEntry, team, scope) {
  return {
    formation: { leaderOutfitCardId: caseEntry.leaderCardId, members: team.members },
    chartKey: caseEntry.chartKey,
    seed: scope.seed,
    accountState: scope.account,
  };
}

function recordMismatch(target, caseEntry, expected, actual) {
  if (target.length < MAX_REPORTED_MISMATCHES) {
    target.push({ caseId: caseEntry.caseId, expected, actual });
  }
}

function runRealCorpus() {
  const scope = JSON.parse(readFileSync(join(ROOT, SCOPE_PATH), "utf8"));
  const fullSample = JSON.parse(readFileSync(join(ROOT, SAMPLE_PATH), "utf8"));
  const sample = realLimit === null ? fullSample : fullSample.slice(0, realLimit);
  const started = performance.now();
  const rust = skipRust ? null : runRustReference(SAMPLE_PATH);
  const mismatches = {
    rustVsCorpus: [],
    typescriptReferenceVsCorpus: [],
    orderedStateRunsVsReference: [],
    bulkVsOrderedStateRuns: [],
    certifiedBulkVsReference: [],
    certifiedCentralVsFull: [],
  };
  const counts = {
    rustVsCorpus: 0,
    typescriptReferenceVsCorpus: 0,
    orderedStateRunsVsReference: 0,
    bulkVsOrderedStateRuns: 0,
    certifiedBulkVsReference: 0,
    certifiedCentralVsFull: 0,
  };
  const bulkFinalModes = {};
  const bulkFallbackReasons = {};
  const centralKinds = {};
  const centralFallbackReasons = {};
  const executionModes = {};
  const digest = createHash("sha256");
  let compilationMilliseconds = 0;
  let referenceMilliseconds = 0;
  let orderedStateRunMilliseconds = 0;
  let bulkMilliseconds = 0;
  let centralMilliseconds = 0;
  let totalStateRuns = 0;

  for (const caseEntry of sample) {
    const compilationStarted = performance.now();
    const team = compileExactOptimizerTeam({
      memberCardIds: caseEntry.memberCardIds,
      investmentLayer: caseEntry.investmentLayer,
      bloomStageByCardId: caseEntry.bloomStages,
    });
    compilationMilliseconds += performance.now() - compilationStarted;
    const input = realCaseInput(caseEntry, team, scope);
    const corpus = {
      lower: caseEntry.referenceLowerMicroUnits,
      central: caseEntry.referenceCentralMicroUnits,
      upper: caseEntry.referenceUpperMicroUnits,
    };
    const rustTuple = rust === null ? null : rust.entries.get(caseEntry.caseId);
    if (rustTuple === undefined) {
      counts.rustVsCorpus += 1;
      recordMismatch(mismatches.rustVsCorpus, caseEntry, corpus, null);
    } else if (rustTuple !== null) {
      const canonicalRust = {
        lower: rustTuple.lowerMicroUnits,
        central: rustTuple.centralMicroUnits,
        upper: rustTuple.upperMicroUnits,
      };
      if (!tuplesEqual(corpus, canonicalRust)) {
        counts.rustVsCorpus += 1;
        recordMismatch(mismatches.rustVsCorpus, caseEntry, corpus, canonicalRust);
      }
    }

    const referenceStarted = performance.now();
    const reference = nativeCanonical(evaluateNativeRelativeUtilityUncompressed(input).relativeUtility);
    referenceMilliseconds += performance.now() - referenceStarted;
    if (!tuplesEqual(corpus, reference)) {
      counts.typescriptReferenceVsCorpus += 1;
      recordMismatch(mismatches.typescriptReferenceVsCorpus, caseEntry, corpus, reference);
    }

    const orderedStarted = performance.now();
    const ordered = evaluateNativeRelativeUtilityWithOrderedStateRuns(input);
    orderedStateRunMilliseconds += performance.now() - orderedStarted;
    const orderedCanonical = nativeCanonical(ordered.result.relativeUtility);
    if (!tuplesEqual(reference, orderedCanonical)) {
      counts.orderedStateRunsVsReference += 1;
      recordMismatch(mismatches.orderedStateRunsVsReference, caseEntry, reference, orderedCanonical);
    }

    const bulkStarted = performance.now();
    const bulk = evaluateExactOptimizerTeamLeader({
      team,
      leaderOutfitCardId: caseEntry.leaderCardId,
      chartKey: caseEntry.chartKey,
      seed: scope.seed,
      accountState: scope.account,
    });
    bulkMilliseconds += performance.now() - bulkStarted;
    if (!tuplesEqual(orderedCanonical, bulk.canonicalUtility)) {
      counts.bulkVsOrderedStateRuns += 1;
      recordMismatch(mismatches.bulkVsOrderedStateRuns, caseEntry, orderedCanonical, bulk.canonicalUtility);
    }
    const bulkTelemetry = bulk.execution.activeTrace.bulk;
    addReason(bulkFinalModes, bulkTelemetry.finalCanonical);
    addReason(bulkFallbackReasons, bulkTelemetry.fallbackReason);
    addReason(executionModes, bulk.execution.mode);
    totalStateRuns +=
      bulk.execution.activeTrace.baseStateRuns +
      bulk.execution.activeTrace.specialSupportStateRuns +
      bulk.execution.activeTrace.specialStateRuns;
    if (
      bulkTelemetry.finalCanonical === "bulk-certified-reference-equivalent" &&
      !tuplesEqual(reference, bulk.canonicalUtility)
    ) {
      counts.certifiedBulkVsReference += 1;
      recordMismatch(mismatches.certifiedBulkVsReference, caseEntry, reference, bulk.canonicalUtility);
    }

    const centralStarted = performance.now();
    const central = evaluateExactOptimizerTeamLeaderCentral({
      team,
      leaderOutfitCardId: caseEntry.leaderCardId,
      chartKey: caseEntry.chartKey,
      seed: scope.seed,
      accountState: scope.account,
    });
    centralMilliseconds += performance.now() - centralStarted;
    addReason(centralKinds, central.kind);
    if (central.kind === "ordered-replay-required") {
      addReason(centralFallbackReasons, central.fallbackReason);
    } else if (central.centralMicroUnits !== bulk.canonicalUtility.central) {
      counts.certifiedCentralVsFull += 1;
      recordMismatch(
        mismatches.certifiedCentralVsFull,
        caseEntry,
        { central: bulk.canonicalUtility.central },
        { central: central.centralMicroUnits },
      );
    }
    digest.update(`${caseEntry.caseId}|${corpus.lower}|${corpus.central}|${corpus.upper}|${reference.lower}|${reference.central}|${reference.upper}|${orderedCanonical.lower}|${orderedCanonical.central}|${orderedCanonical.upper}|${bulk.canonicalUtility.lower}|${bulk.canonicalUtility.central}|${bulk.canonicalUtility.upper}|${central.kind}|${central.centralMicroUnits ?? "fallback"}\n`);
  }

  const rustOutputCountMismatch = rust !== null && rust.outputCount !== fullSample.length;
  if (rustOutputCountMismatch) {
    counts.rustVsCorpus += 1;
    if (mismatches.rustVsCorpus.length < MAX_REPORTED_MISMATCHES) {
      mismatches.rustVsCorpus.push({ expectedOutputCount: fullSample.length, actualOutputCount: rust.outputCount });
    }
  }
  const passed = Object.values(counts).every((count) => count === 0) &&
    (skipRust || rustOutputCountMismatch === false);
  return {
    methodologyVersion: RUNNER_VERSION,
    input: {
      scopePath: SCOPE_PATH,
      scopeHash: scope.scopeHash,
      samplePath: SAMPLE_PATH,
      sampleSha256: sha256File(SAMPLE_PATH),
      expectedCorpusCases: fullSample.length,
      evaluatedCases: sample.length,
      reducedByDebugLimit: realLimit !== null,
    },
    orderedRustReference: rust === null
      ? { status: "skipped-by-explicit-debug-flag" }
      : {
          outputCount: rust.outputCount,
          elapsedMilliseconds: rust.elapsedMilliseconds,
          outputCountMatchesFullCorpus: rust.outputCount === fullSample.length,
        },
    implementations: {
      typescriptReference: "evaluateNativeRelativeUtilityUncompressed",
      orderedStateRuns: "evaluateNativeRelativeUtilityWithOrderedStateRuns",
      bulkCertified: "evaluateExactOptimizerTeamLeader",
      centralB2: "evaluateExactOptimizerTeamLeaderCentral; strict-loss screening only",
    },
    comparisonMismatches: counts,
    firstMismatches: mismatches,
    bulk: {
      finalCanonicalModes: bulkFinalModes,
      fallbackReasons: bulkFallbackReasons,
      executionModes,
      totalStateRuns,
    },
    centralB2: {
      kinds: centralKinds,
      fallbackReasons: centralFallbackReasons,
      equalityOrFinalistPolicy: "A B2 equality/finalist has no tuple and must promote to B3; only a certified strict central loss may prune.",
    },
    timing: {
      teamCompilationMilliseconds: rounded(compilationMilliseconds),
      typescriptReferenceMilliseconds: rounded(referenceMilliseconds),
      orderedStateRunMilliseconds: rounded(orderedStateRunMilliseconds),
      bulkMilliseconds: rounded(bulkMilliseconds),
      centralB2Milliseconds: rounded(centralMilliseconds),
      totalElapsedMilliseconds: rounded(performance.now() - started),
    },
    deterministicDigest: digest.digest("hex"),
    passed,
  };
}

function main() {
  if (rehashExisting) {
    const existing = JSON.parse(readFileSync(join(ROOT, OUTPUT_PATH), "utf8"));
    if (existing.synthetic?.caseCount !== SYNTHETIC_CASE_COUNT || existing.realCorpus?.input?.evaluatedCases !== 100_000) {
      throw new Error("--rehash-existing requires the complete 1000000-case synthetic and 100000-case real artifact");
    }
    // Rehash may only re-bless an artifact whose recorded evidence is itself
    // clean; a corrupted or failing artifact must be re-executed, not migrated.
    const mismatchCounters = Object.values(existing.realCorpus?.comparisonMismatches ?? { invalid: 1 });
    if (
      existing.passed !== true ||
      existing.synthetic?.passed !== true ||
      existing.realCorpus?.passed !== true ||
      existing.synthetic?.falseCertificates !== 0 ||
      existing.synthetic?.containmentFailures !== 0 ||
      existing.synthetic?.expectedFallbackFailures !== 0 ||
      mismatchCounters.length === 0 ||
      mismatchCounters.some((count) => count !== 0) ||
      typeof existing.synthetic?.deterministicDigest !== "string" ||
      typeof existing.realCorpus?.deterministicDigest !== "string"
    ) {
      throw new Error("--rehash-existing refuses a failing or incomplete artifact; rerun the full corpus instead");
    }
    const legacyHash = existing.legacyVolatileReportHash ?? existing.deterministicReportHash ?? null;
    const upgraded = {
      ...existing,
      schemaVersion: 2,
      evidenceDigestMethodologyVersion: "yd-exact-optimizer-bulk-evidence-digest-1",
      deterministicEvidenceDigest: stableEvidenceDigest(existing),
      legacyVolatileReportHash: legacyHash,
      legacyVolatileReportHashes: [
        {
          hash: "be71471f245bf33e8aa6394441fba264507b3cb863b3c422303e9ef6fda971c5",
          label: "primary full run",
          qualification: "legacy volatile report hash; the identical evidence digest is authoritative",
        },
        {
          hash: legacyHash,
          label: "interrupted duplicate full run",
          qualification: "legacy volatile report hash; timing differs but all evidence counters and corpus digests match the primary run",
        },
      ],
      runtimeMetadata: runtimeMetadata(existing),
    };
    delete upgraded.deterministicReportHash;
    writeFileSync(join(ROOT, OUTPUT_PATH), `${JSON.stringify(upgraded, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({
      path: OUTPUT_PATH,
      deterministicEvidenceDigest: upgraded.deterministicEvidenceDigest,
      legacyVolatileReportHash: upgraded.legacyVolatileReportHash,
      passed: upgraded.passed,
    }, null, 2)}\n`);
    return;
  }
  const started = performance.now();
  const synthetic = realOnly ? null : runSyntheticBoundaries();
  const realCorpus = syntheticOnly ? null : runRealCorpus();
  const passed = (synthetic?.passed ?? true) && (realCorpus?.passed ?? true);
  const reportWithoutHash = {
    schemaVersion: 2,
    reportId: REPORT_ID,
    runnerVersion: RUNNER_VERSION,
    generatedAt: new Date().toISOString(),
    synthetic,
    realCorpus,
    passed,
    certificateEligible: false,
    disposition: passed
      ? "Bulk accumulation parity evidence passed. This artifact validates a bounded optimization primitive and does not certify a global optimizer result."
      : "Bulk accumulation parity evidence failed or is partial; bulk certification must not be used for pruning until the reported discrepancies are resolved.",
    elapsedMilliseconds: rounded(performance.now() - started),
  };
  const report = {
    ...reportWithoutHash,
    evidenceDigestMethodologyVersion: "yd-exact-optimizer-bulk-evidence-digest-1",
    deterministicEvidenceDigest: stableEvidenceDigest(reportWithoutHash),
    legacyVolatileReportHash: sha256({ ...reportWithoutHash, generatedAt: "omitted-for-legacy-hash" }),
    runtimeMetadata: runtimeMetadata(reportWithoutHash),
  };
  // A deliberately limited/debug run is useful locally but must never replace
  // the full 1M + 100k evidence artifact.
  if (!syntheticOnly && !realOnly && realLimit === null && !skipRust) {
    writeFileSync(join(ROOT, OUTPUT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

main();
