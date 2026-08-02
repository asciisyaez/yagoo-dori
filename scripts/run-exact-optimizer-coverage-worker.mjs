import process from "node:process";

import { executeExactOptimizerCoverageParitySlice } from "../packages/core/src/exact-optimizer-coverage.ts";

const argument = process.argv.find((value) => value.startsWith("--case-indexes="));
if (!argument) {
  throw new Error("Expected --case-indexes=<comma-separated indexes>");
}

const caseIndexes = argument
  .slice("--case-indexes=".length)
  .split(",")
  .filter(Boolean)
  .map((value) => Number.parseInt(value, 10));
if (caseIndexes.length === 0 || caseIndexes.some((value) => !Number.isSafeInteger(value))) {
  throw new Error("Coverage worker case indexes must be safe integers");
}

process.stdout.write(JSON.stringify(executeExactOptimizerCoverageParitySlice({ caseIndexes })));
