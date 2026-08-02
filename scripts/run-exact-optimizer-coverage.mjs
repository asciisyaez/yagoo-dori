import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildExactOptimizerCoverageLedger,
  validateExactOptimizerCoverageLedger,
} from "../packages/core/src/exact-optimizer-coverage.ts";

const report = await buildExactOptimizerCoverageLedger();
validateExactOptimizerCoverageLedger(report);

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

// The executable ledger retains all individual case IDs in memory so that the
// validator can reject a synthetic count. The checked-in run artifact is a
// compact, content-addressed projection: it exposes each axis, zero count,
// and a hash of the concrete IDs without committing a multi-megabyte trace.
const compactWithoutHash = {
  schemaVersion: 1,
  kind: "exact-optimizer-coverage-summary",
  methodologyVersion: report.methodologyVersion,
  scopeHash: report.scopeHash,
  kernelVersion: report.kernelVersion,
  traceVersion: report.traceVersion,
  executableLedgerHash: report.ledgerHash,
  coverage: report.coverage.map((axis) => ({
    id: axis.id,
    entryCount: axis.entries.length,
    zeroEntryCount: axis.entries.filter((entry) => entry.count === 0).length,
    executedCaseCount: axis.entries.reduce((total, entry) => total + entry.count, 0),
    entryKeyHash: sha256(axis.entries.map((entry) => entry.key)),
    caseIdHash: sha256(axis.entries.map((entry) => entry.caseIds)),
  })),
  gates: report.gates,
  requiredZeroCoverage: report.requiredZeroCoverage,
  certificateEligible: false,
};
const compact = {
  ...compactWithoutHash,
  reportHash: sha256(compactWithoutHash),
};

const outputPath = join(process.cwd(), "data/native/exact-optimizer-coverage-v1.json");
writeFileSync(outputPath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(compact, null, 2)}\n`);
