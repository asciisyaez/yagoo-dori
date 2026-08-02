import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateNativeRelativeUtility } from "../packages/core/src/native-utility.ts";
import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const ir = readJson("data/native/exact-optimizer-parity-ir-v1.json");
const board = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:exact-reduced-bruteforce",
  },
};

const memberIds = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
  "card-00018-5-uniq-0004-00",
  "card-00019-5-uniq-0016-00",
  "card-00039-5-uniq-0032-00",
];
const leaderIds = [
  "card-00001-5-uniq-0000-00",
  "card-00013-5-uniq-0002-00",
  "card-00019-5-uniq-0016-00",
  "card-00039-5-uniq-0032-00",
];
const cardsById = new Map(ir.cards.map((card) => [card.cardId, card]));
const combinations = (values, size) => {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const [head, ...tail] = values;
  return [
    ...combinations(tail, size - 1).map((rest) => [head, ...rest]),
    ...combinations(tail, size),
  ];
};
const teams = combinations(memberIds, 5).filter((team) => {
  const talents = team.map((id) => cardsById.get(id)?.talentId);
  return new Set(talents).size === 5 && team.filter((id) => cardsById.get(id)?.rarity === 5).length <= 5;
});
if (teams.length === 0) throw new Error("Reduced brute-force fixture has no legal teams");

const cases = teams.flatMap((memberCardIds, teamIndex) =>
  leaderIds.map((leaderCardId, leaderIndex) => ({
    caseId: teamIndex * leaderIds.length + leaderIndex,
    leaderCardId,
    memberCardIds: [...memberCardIds].sort(),
    chartKey: "m0206:expert",
    investmentLayer: "one-copy-maximum",
    bloomStages: Object.fromEntries(memberCardIds.map((cardId) => [cardId, 0])),
  })),
);

const expected = new Map(cases.map((entry) => {
  const utility = evaluateNativeRelativeUtility({
    formation: {
      leaderOutfitCardId: entry.leaderCardId,
      members: entry.memberCardIds.map((cardId) => ({ cardId, investment: "one-copy-maximum", bloomStage: 0 })),
    },
    chartKey: entry.chartKey,
    seed: scope.seed,
    accountState: board,
  }).relativeUtility;
  return [entry.caseId, {
    lowerMicroUnits: toCanonicalMicroUnits(utility.lower),
    centralMicroUnits: toCanonicalMicroUnits(utility.central),
    upperMicroUnits: toCanonicalMicroUnits(utility.upper),
  }];
}));

const parityPath = join(root, "data/native/exact-optimizer-reduced-parity-cases-v1.json");
writeFileSync(parityPath, `${JSON.stringify(cases)}\n`, "utf8");
const processResult = spawnSync(
  "cargo",
  ["run", "--release", "--manifest-path", "tools/exact-global-solver/Cargo.toml", "--", "tools/exact-global-solver/kernel.json", parityPath],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (processResult.status !== 0) throw new Error(`Reduced compiled evaluator failed: ${processResult.stderr}`);
const actual = processResult.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const actualById = new Map(actual.map((entry) => [entry.caseId, entry]));
const mismatches = [];
for (const [caseId, reference] of expected.entries()) {
  const candidate = actualById.get(caseId);
  if (!candidate || candidate.lowerMicroUnits !== reference.lowerMicroUnits || candidate.centralMicroUnits !== reference.centralMicroUnits || candidate.upperMicroUnits !== reference.upperMicroUnits) {
    if (mismatches.length < 20) mismatches.push({ caseId, reference, candidate: candidate ?? null });
  }
}
const compare = (left, right) => {
  for (const field of ["centralMicroUnits", "lowerMicroUnits", "upperMicroUnits"]) {
    if (left[field] !== right[field]) return right[field] - left[field];
  }
  return `${left.leaderCardId}|${left.memberCardIds.join("|")}`.localeCompare(`${right.leaderCardId}|${right.memberCardIds.join("|")}`);
};
const candidates = cases.map((entry) => ({
  ...entry,
  ...expected.get(entry.caseId),
}));
const tsWinner = [...candidates].sort(compare)[0];
const compiledWinner = [...actual].map((entry) => ({
  ...cases[entry.caseId],
  ...entry,
})).sort(compare)[0];
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-reduced-bruteforce-v1",
  generatedAt: new Date().toISOString(),
  scopeHash: scope.scopeHash,
  irHash: ir.irHash,
  fixtureRoster: { memberIds, leaderIds, chartKey: "m0206:expert" },
  legalTeamSets: teams.length,
  casesEvaluated: cases.length,
  compiledOutputCount: actual.length,
  mismatchCount: mismatches.length,
  tsWinner: { leaderCardId: tsWinner.leaderCardId, memberCardIds: tsWinner.memberCardIds, centralMicroUnits: tsWinner.centralMicroUnits },
  compiledWinner: { leaderCardId: compiledWinner.leaderCardId, memberCardIds: compiledWinner.memberCardIds, centralMicroUnits: compiledWinner.centralMicroUnits },
  winnerMatches: tsWinner.leaderCardId === compiledWinner.leaderCardId && tsWinner.memberCardIds.join("|") === compiledWinner.memberCardIds.join("|"),
  parityEligible: mismatches.length === 0 && actual.length === cases.length,
  certificateEligible: false,
  mismatches,
  caseHash: createHash("sha256").update(JSON.stringify(cases), "utf8").digest("hex"),
  disposition: mismatches.length === 0 && actual.length === cases.length
    ? "Reduced-roster compiled evaluator and independent TypeScript brute force agree; this is not a full-roster certificate."
    : "Reduced-roster parity failed; compiled prototype remains ineligible for certification.",
};
writeFileSync(join(root, "data/native/exact-optimizer-reduced-parity-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.parityEligible !== true) process.exitCode = 1;
