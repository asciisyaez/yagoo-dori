import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { evaluateNativeRelativeUtility } from "../packages/core/src/native-utility.ts";
import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const sample = readJson("data/native/exact-optimizer-parity-sample-v1.json");
const requestedCaseId = Number(process.env.YD_PARITY_DIAGNOSTIC_CASE ?? 0);
const entry = sample.find((candidate) => candidate.caseId === requestedCaseId);
if (!entry) throw new Error(`Parity sample does not contain case ${requestedCaseId}`);

const board = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:native-global-bound",
  },
};
const reference = evaluateNativeRelativeUtility({
  formation: {
    leaderOutfitCardId: entry.leaderCardId,
    members: entry.memberCardIds.map((cardId) => ({
      cardId,
      investment: entry.investmentLayer,
      bloomStage: entry.bloomStages[cardId],
    })),
  },
  chartKey: entry.chartKey,
  seed: scope.seed,
  accountState: board,
});

const temporaryDirectory = mkdtempSync(join(tmpdir(), "yagoo-dori-parity-"));
const temporaryInput = join(temporaryDirectory, "case.json");
writeFileSync(temporaryInput, `${JSON.stringify([entry])}\n`, "utf8");
try {
  const processResult = spawnSync(
    "cargo",
    [
      "run",
      "--release",
      "--manifest-path",
      "tools/exact-global-solver/Cargo.toml",
      "--",
      "tools/exact-global-solver/kernel.json",
      temporaryInput,
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  if (processResult.status !== 0) {
    throw new Error(`Compiled diagnostic process failed (${processResult.status}): ${processResult.stderr}`);
  }
  const compiled = JSON.parse(processResult.stdout.trim());
  const diagnostic = {
    schemaVersion: 1,
    reportId: "yd-exact-parity-diagnostic-v1",
    scopeHash: scope.scopeHash,
    caseId: entry.caseId,
    input: entry,
    reference: {
      centralMicroUnits: toCanonicalMicroUnits(reference.relativeUtility.central),
      relativeUtility: reference.relativeUtility,
      components: {
        baseUnits: reference.components.baseParameters.relativeUnits.central,
        parameterUnits: reference.components.parameterEffects.relativeUnits.central,
        activeUnits: reference.components.active.relativeUnits.central,
        averageEffectiveActiveUpPermil: reference.components.active.averageEffectiveUpPermil.central,
        specialUnits: reference.components.special.relativeUnits.central,
        specialScoreSupportUnits: reference.components.special.scoreSupportRelativeUnits.central,
        specialActivationRateUnits: reference.components.special.activationRate.relativeUnits.central,
        specialActivationRateUpPermil: reference.components.special.activationRate.modeledAverageActivationRateUpPermil.central,
        persistentSupport: reference.components.persistentScoreSupport.byMember,
      },
    },
    compiled,
    deltas: {
      centralMicroUnits: compiled.centralMicroUnits - toCanonicalMicroUnits(reference.relativeUtility.central),
      baseUnits: compiled.baseUnits - reference.components.baseParameters.relativeUnits.central,
      parameterUnits:
        compiled.memberParameterUnits + compiled.leaderParameterUnits -
        reference.components.parameterEffects.relativeUnits.central,
    },
    disposition:
      "Diagnostic only. It identifies semantic components for one mismatch; it is not a parity result or certificate.",
  };
  writeFileSync(
    join(root, "data/native/exact-optimizer-parity-diagnostic-v1.json"),
    `${JSON.stringify(diagnostic, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(diagnostic, null, 2));
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
