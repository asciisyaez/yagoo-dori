import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const { calculateOwnedRosterTeam, TEAM_CALCULATOR_ROSTER_COMMIT } =
  await tsImport("../packages/core/src/team-calculator.ts", import.meta.url);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(scriptDirectory, "..", ".claude", "handover-artifacts", "calc-quality-fixtures");

async function readJson(fileName) {
  return JSON.parse(await readFile(join(fixtureDirectory, fileName), "utf8"));
}

function requestFor(row, extra = {}) {
  return {
    schemaVersion: 5,
    rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
    ownedCards: row.rosterCards,
    requiredMemberCardIds: [],
    searchEffort: "thorough",
    ...extra,
  };
}

function parseArguments(argumentsList) {
  const dropOneLimitIndex = argumentsList.indexOf("--drop-one-limit");
  const parsedDropOneLimit = dropOneLimitIndex >= 0
    ? Number(argumentsList[dropOneLimitIndex + 1])
    : 10;
  if (!Number.isInteger(parsedDropOneLimit) || parsedDropOneLimit < 0) {
    throw new Error("--drop-one-limit must be a non-negative integer");
  }
  return {
    dropOneLimit: parsedDropOneLimit,
    includeInversions: argumentsList.includes("--inversions"),
    includeBudgetRegressions: argumentsList.includes("--budget-regressions"),
  };
}

// --- t10 roster regeneration -------------------------------------------------
// The t10 fixtures record roster IDs and metrics only; the rosters themselves
// come from the measurement harness's deterministic sampler, ported verbatim
// (mulberry32 PRNG, Fisher-Yates shuffle, rarity-capped bloom stages, seed
// formula 0x090000 + size*617 + rep, flavor random for even reps and
// five-star-heavy for odd reps).
const { publicCards } = await tsImport("../packages/core/src/public-data.ts", import.meta.url);
const FIVE_STARS = publicCards.filter((card) => card.rarity === 5);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rand) {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    [out[index], out[swapIndex]] = [out[swapIndex], out[index]];
  }
  return out;
}

function bloomFor(card, rand) {
  const max = card.rarity === 5 ? 3 : 5;
  return Math.min(max, Math.floor(rand() * (max + 1)));
}

function sampleRoster(size, flavor, seed) {
  const rand = mulberry32(seed);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let pool;
    if (flavor === "five-star-heavy") {
      const fiveCount = Math.max(1, Math.round(size * 0.75));
      const picks = [
        ...shuffled(FIVE_STARS, rand).slice(0, fiveCount),
        ...shuffled(publicCards, rand).slice(0, size),
      ];
      const seen = new Set();
      pool = picks.filter((card) => (seen.has(card.id) ? false : (seen.add(card.id), true)));
    } else {
      pool = shuffled(publicCards, rand);
    }
    const chosen = pool.slice(0, size);
    if (chosen.length < size) continue;
    if (new Set(chosen.map((card) => card.talentId)).size < 5) continue;
    return chosen
      .map((card) => ({ cardId: card.id, bloomStage: bloomFor(card, rand) }))
      .sort((left, right) => left.cardId.localeCompare(right.cardId));
  }
  throw new Error(`Could not sample a legal roster of size ${size} (seed ${seed})`);
}

function rosterForBudgetFixture(rosterId) {
  const match = /^bc-(\d+)-(\d+)$/.exec(rosterId);
  if (!match) throw new Error(`Unrecognized t10 roster id: ${rosterId}`);
  const size = Number(match[1]);
  const rep = Number(match[2]);
  const flavor = rep % 2 === 0 ? "random" : "five-star-heavy";
  return sampleRoster(size, flavor, 0x09_0000 + size * 617 + rep);
}

function replayBudgetRegressions(rows) {
  let regressions = 0;
  let failures = 0;
  for (const row of rows) {
    try {
      const rosterCards = rosterForBudgetFixture(row.rosterId);
      const result = calculateOwnedRosterTeam(requestFor({ rosterCards }));
      // The recorded shippedCentral is the pre-Ticket-B 4x2 baseline; the
      // upgraded search must never return below it.
      if (result.score.relativeUtility.central < row.shippedCentral) {
        regressions += 1;
        console.error(
          `budget ${row.rosterId}: ${result.score.relativeUtility.central} below shipped ${row.shippedCentral}`,
        );
      }
    } catch (error) {
      failures += 1;
      console.error(`budget ${row.rosterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { checked: rows.length, regressions, failures };
}

function replayDropOne(rows, limit) {
  const selectedRows = rows.slice(0, limit);
  let violations = 0;
  let failures = 0;
  for (const row of selectedRows) {
    try {
      const full = calculateOwnedRosterTeam(requestFor(row));
      const reduced = calculateOwnedRosterTeam(
        requestFor({
          ...row,
          rosterCards: row.rosterCards.filter((card) => card.cardId !== row.droppedCardId),
        }),
      );
      if (reduced.score.relativeUtility.central > full.score.relativeUtility.central) {
        violations += 1;
        console.error(
          `drop-one VIOLATION ${row.rosterId} drop=${row.droppedCardId}: reduced ${reduced.score.relativeUtility.central} > full ${full.score.relativeUtility.central} (${(((reduced.score.relativeUtility.central - full.score.relativeUtility.central) / full.score.relativeUtility.central) * 100).toFixed(3)}%)`,
        );
      }
    } catch (error) {
      failures += 1;
      console.error(`drop-one ${row.rosterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { checked: selectedRows.length, violations, failures };
}

function replayInversions(rows) {
  let inversions = 0;
  let failures = 0;
  for (const row of rows) {
    try {
      const unconstrained = calculateOwnedRosterTeam(requestFor(row));
      const constrained = calculateOwnedRosterTeam(
        requestFor(row, { oshi: { talentId: row.oshiTalentId, role: row.role } }),
      );
      if (constrained.score.relativeUtility.central > unconstrained.score.relativeUtility.central) {
        inversions += 1;
        console.error(
          `inversion VIOLATION ${row.rosterId} role=${row.role}: constrained ${constrained.score.relativeUtility.central} > unconstrained ${unconstrained.score.relativeUtility.central}`,
        );
      }
    } catch (error) {
      failures += 1;
      console.error(`inversion ${row.rosterId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { checked: rows.length, inversions, failures };
}

const { dropOneLimit, includeInversions, includeBudgetRegressions } = parseArguments(process.argv.slice(2));
const dropOneRows = [
  ...(await readJson("t1-violations-6-8.json")),
  ...(await readJson("t1-violations-9-11.json")),
  ...(await readJson("t1-violations-12-14.json")),
];
const dropOneResult = replayDropOne(dropOneRows, dropOneLimit);
console.log(
  `drop-one: checked ${dropOneResult.checked}, remaining violations ${dropOneResult.violations}, failures ${dropOneResult.failures}`,
);

if (includeInversions) {
  const inversionResult = replayInversions(await readJson("t2-inversions.json"));
  console.log(
    `inversions: checked ${inversionResult.checked}, remaining inversions ${inversionResult.inversions}, failures ${inversionResult.failures}`,
  );
}

if (includeBudgetRegressions) {
  const budgetResult = replayBudgetRegressions(await readJson("t10-nonmonotonic-budget.json"));
  console.log(
    `budget-regressions: checked ${budgetResult.checked}, below shipped baseline ${budgetResult.regressions}, failures ${budgetResult.failures}`,
  );
}
