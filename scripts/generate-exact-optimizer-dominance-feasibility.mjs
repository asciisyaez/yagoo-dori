import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = "data/native/exact-optimizer-dominance-feasibility-v1.json";
const SCOPE_PATH = "data/native/exact-optimizer-scope-v1.json";
const BULK_PATH = "data/native/exact-optimizer-bulk-parity-v1.json";
const PERFORMANCE_PATH = "data/native/exact-optimizer-bulk-performance-v1.json";

// Must serialize exactly what JSON.stringify writes to the artifact file:
// undefined object values are dropped and undefined array items become null,
// otherwise the recorded digest is not reproducible from the file bytes.
function canonicalize(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

const scope = readJson(SCOPE_PATH);
const bulk = readJson(BULK_PATH);
const performance = readJson(PERFORMANCE_PATH);
if (!bulk.deterministicEvidenceDigest || bulk.evidenceDigestMethodologyVersion !== "yd-exact-optimizer-bulk-evidence-digest-1") {
  throw new Error("Dominance feasibility requires the stable bulk evidence digest");
}
if (performance.certificateEligible || performance.conditionalDominanceDecision?.status !== "conditional-not-authorized") {
  throw new Error("Dominance feasibility cannot be recorded from an authorized bulk path");
}

const reportWithoutHash = {
  schemaVersion: 1,
  reportId: "yd-exact-optimizer-dominance-feasibility-v1",
  methodologyVersion: "yd-exact-optimizer-dominance-feasibility-1.0.0",
  sourceArtifacts: {
    scopePath: SCOPE_PATH,
    scopeHash: scope.scopeHash,
    bulkParityPath: BULK_PATH,
    bulkParityEvidenceDigest: bulk.deterministicEvidenceDigest,
    bulkPerformancePath: PERFORMANCE_PATH,
    bulkPerformanceDeterministicReportHash: performance.deterministicReportHash,
  },
  phase: 7,
  attempted: false,
  disposition: "killed-before-pilot",
  killCriterion: {
    id: "continuation-complete-state-proof-unavailable",
    reached: true,
    statement: "Do not construct or measure a partial-team dominance frontier until one state key is proven sufficient to resume every legal suffix under the reference recurrence and comparator.",
    missingProofs: [
      {
        requirement: "A partial state must retain a Leader-specific continuation, not merely a Member-set bound.",
        interaction: "Leader applications resolve recipients, support, and parameter effects after the completed five-Member formation is known; the existing B0/B1 contexts are outward bounds and cannot resume an exact suffix.",
      },
      {
        requirement: "A dominance key must retain formation order, Member identity, Bloom/investment progression, trigger counters, and every unresolved Active/Special branch needed by later notes.",
        interaction: "The reference evaluator derives note-state contributions from the completed formation and chart timeline. Omitting any branch can change a later source-order contribution even when a partial central bound is equal.",
      },
      {
        requirement: "A dominance relation must preserve the incoming binary64 enclosure and its source-order position for each lower/central/upper pass.",
        interaction: "The accepted bulk contract certifies only a complete canonical enclosure; an ambiguous component replays the smallest affected run left-to-right. A frontier that merges prefix accumulators would need a new RN-even continuation proof before it could prune.",
      },
      {
        requirement: "A surviving state must carry the full candidate tie key and enough suffix identity to prove equality/finalist promotion to B3.",
        interaction: "B2 may prune only a certified strict central loss. Equal, fallback, and finalist states materialize B3, so a partial dominance relation cannot take equality credit without an exhaustive suffix and tie-order proof.",
      },
    ],
    requiredEvidenceToReopen: [
      "A continuation-complete state schema and proof that every legal suffix is represented exactly for each fixed Leader and chart.",
      "An exhaustive reduced-roster suffix comparison that enumerates every omitted continuation and matches ordered lower/central/upper results and tie ordering.",
      "A proof that any dominance prune is a strict canonical central loss, with equality/fallback/finalist promotion to B3 and complete accounting.",
    ],
  },
  pilot: {
    status: "not-started",
    reason: "The kill criterion is met before a reduced roster or frontier is selected. No bounded state-dominance experiment is represented as measured.",
    reducedRoster: null,
    exhaustiveSuffixValidation: "not-run: no continuation-complete state representation exists to validate",
  },
  proofCredit: {
    dominancePrunes: 0,
    candidateStatesConstructed: 0,
    frontierMetrics: "not-collected: attempted=false; no frontier was built or timed",
    fullScopeProjectionCredit: 0,
  },
  decision: {
    fullRunAuthorized: false,
    certificateEligible: false,
    nextUnblockedAction: "Design and prove a continuation-complete fixed-Leader partial state before selecting any reduced roster; then run exhaustive suffix validation before timing a dominance frontier.",
  },
};
const report = {
  ...reportWithoutHash,
  deterministicReportHash: sha256(reportWithoutHash),
};
writeFileSync(join(ROOT, OUTPUT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  path: OUTPUT_PATH,
  attempted: report.attempted,
  disposition: report.disposition,
  dominancePrunes: report.proofCredit.dominancePrunes,
  certificateEligible: report.decision.certificateEligible,
  fullRunAuthorized: report.decision.fullRunAuthorized,
  deterministicReportHash: report.deterministicReportHash,
}, null, 2)}\n`);
