import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const sha256File = (relativePath) => createHash("sha256").update(readFileSync(join(root, relativePath))).digest("hex");

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const benchmarkPath = "data/native/ranking-benchmark-v1.json";
const benchmark = readJson(benchmarkPath);
const cardIds = [...benchmark.cohort.orderedCardIds].sort();
const chartEntries = [...benchmark.corpus.reference, ...benchmark.corpus.current]
  .map(({ chartKey, expectedChartHash }) => ({ chartKey, expectedChartHash, weightNumerator: 1, weightDenominator: 30 }));
const timelineSource = readJson("data/native/chart-timeline-source.json");

const scope = {
  schemaVersion: 1,
  scopeId: "yd-exact-full-roster-v1",
  roster: {
    sourceRepository: benchmark.sources.roster.repository,
    sourceCommit: benchmark.sources.roster.commit,
    publicDataPath: "data/generated/holodori-public.json",
    publicDataSha256: sha256File("data/generated/holodori-public.json"),
    orderedCardIdsSha256: benchmark.cohort.orderedCardIdsSha256,
    cardCount: cardIds.length,
  },
  mechanics: {
    path: "data/generated/holodori-mechanics.json",
    sha256: sha256File("data/generated/holodori-mechanics.json"),
    evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
  },
  songCorpus: {
    path: "data/generated/holodori-songs.json",
    sha256: sha256File("data/generated/holodori-songs.json"),
    songCorpusVersion: "pinned-public-songs-v1",
  },
  chartCorpus: {
    benchmarkPath,
    benchmarkId: benchmark.benchmarkId,
    benchmarkSha256: sha256File(benchmarkPath),
    timelineProjectionPath: "data/generated/holodori-ranking-corpus-timelines.json",
    timelineProjectionSha256: sha256File("data/generated/holodori-ranking-corpus-timelines.json"),
    difficulty: benchmark.corpus.difficulty,
    weighting: "equal-per-chart",
    chartCount: chartEntries.length,
    referenceChartCount: benchmark.corpus.reference.length,
    currentChartCount: benchmark.corpus.current.length,
    entries: chartEntries,
  },
  exactTimeline: {
    sourceId: timelineSource.sourceId,
    apiRevision: timelineSource.apiRevision,
    parserRepository: timelineSource.parserReference.repository,
    parserCommit: timelineSource.parserReference.commit,
    sourceManifestPath: "data/native/chart-timeline-source.json",
    sourceManifestSha256: sha256File("data/native/chart-timeline-source.json"),
    fullTimelinePath: "data/generated/holodori-chart-timelines.json",
    fullTimelineSha256: sha256File("data/generated/holodori-chart-timelines.json"),
    revision: `holodori-best-chart-corpus-r${timelineSource.apiRevision}`,
  },
  eligibility: {
    eligibleMemberCardIds: cardIds,
    eligibleLeaderOutfitCardIds: cardIds,
    fixedMemberCardIds: [],
    oshi: null,
    maximumFiveStarMembers: 5,
  },
  investment: {
    layer: "one-copy-maximum",
    duplicateOnlyBoosts: false,
    bloomStageByCardId: Object.fromEntries(cardIds.map((cardId) => [cardId, 0])),
  },
  account: {
    stateId: "declared-neutral-board-v1",
    board: {
      mode: "declared-neutral",
      evidenceGrade: "verified",
      evidenceRef: "fixture:native-global-bound",
    },
    collectionBonus: "neutral-fixed",
    connectEffects: "neutral-fixed",
  },
  seed: 0x5941474f,
  evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
  arithmeticMethodologyVersion: "yd-canonical-micro-units-1.0.0",
  objective: {
    objectiveId: "yd-aggregate-central-lower-upper-micro-v1",
    aggregation: "equal-chart-average",
    utilityUnit: "parameter-equivalent-relative-unit",
    precision: "signed-integer-six-decimal-micro-units",
    comparator: ["central", "lower", "upper", "leaderCardId|sortedMemberCardIds"],
    memberOrderForCertificate: "unordered-canonical-sorted-card-ids",
    formationOrderIncluded: false,
  },
  formationOrderClaim: {
    claimId: "yd-conditional-order-timing-regret-v1",
    status: "conditional-on-selected-aggregate-optimal-team",
    permutations: 120,
    methodologyVersion: "yd-formation-order-timed-corpus-1.0.0",
    globallyCertified: false,
  },
};

const scopeHash = createHash("sha256").update(canonicalize(scope)).digest("hex");
const output = { ...scope, scopeHash };
const outputPath = join(root, "data/native/exact-optimizer-scope-v1.json");
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath: "data/native/exact-optimizer-scope-v1.json", scopeHash, cardCount: cardIds.length, chartCount: chartEntries.length }, null, 2));
