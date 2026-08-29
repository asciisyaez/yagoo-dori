import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGithubRaw } from "./lib/fetch-github-raw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = join(root, "data", "generated", "holodori-songs.json");

const sourceSnapshot = {
  repository: "https://github.com/HolodoriDB/holodori-db-eng-diff",
  commit: "95e08ebe8f5b0bec83af036230f10291726b7130",
  masterVersion: "fbca8c670e074558b24708bf163fff446a614f709afa9d1784395a15444121b0",
};
const transformVersion = "song-contexts-v2";
const retrievedAt = process.argv
  .find((argument) => argument.startsWith("--retrieved-at="))
  ?.split("=")[1] ?? new Date().toISOString().slice(0, 10);

const sourceFiles = [
  "HelpContent.json",
  "LangHelpContent_Eng.json",
  "LangMusic_Eng.json",
  "LiveCombo.json",
  "LiveDeckEvaluationBonusRank.json",
  "LiveDeckEvaluationRank.json",
  "LiveDeckPowerRank.json",
  "LiveNote.json",
  "LiveNoteJudgementTechnicalScore.json",
  "LiveScoreEvaluationRank.json",
  "Music.json",
  "MusicDifficulty.json",
  "MusicDifficultyChart.json",
  "MusicDifficultyConfiguration.json",
  "Setting.json",
];

function rawUrl(file) {
  return `${sourceSnapshot.repository.replace("github.com", "raw.githubusercontent.com")}/${sourceSnapshot.commit}/${file}`;
}

async function fetchJson(file) {
  const response = await fetchGithubRaw(rawUrl(file), {
    accept: "application/json",
    userAgent: "Yagoo-dori song-context indexer (+https://github.com/asciisyaez/yagoo-dori)",
  });
  return response.json();
}

function sourceStamp(table, rowKey) {
  return {
    repository: sourceSnapshot.repository,
    url: `${sourceSnapshot.repository}/blob/${sourceSnapshot.commit}/${table}`,
    commit: sourceSnapshot.commit,
    masterVersion: sourceSnapshot.masterVersion,
    retrievedAt,
    table,
    rowKey: String(rowKey),
    transformVersion,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function enumSuffix(value, marker) {
  const index = value.indexOf(marker);
  assert(index >= 0, `Unexpected enum value ${value}; expected marker ${marker}`);
  return value.slice(index + marker.length).toLowerCase().replaceAll("_", "-");
}

function nullableNumber(value) {
  return value === undefined || value === null ? null : Number(value);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

const fetched = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (file) => [file, await fetchJson(file)])),
);

const languageRows = new Map(
  fetched["LangMusic_Eng.json"].map((record) => [record.data.id, record]),
);
const songs = fetched["Music.json"]
  .map((record) => {
    const row = record.data;
    const titleRecord = languageRows.get(row.titleLangId);
    assert(titleRecord, `Missing English title ${row.titleLangId} for ${row.id}`);
    return {
      id: row.id,
      title: cleanText(titleRecord.data.text),
      playingMilliseconds: Number(row.playingSeconds) * 1_000,
      category: enumSuffix(row.categoryType, "MUSIC_CATEGORY_TYPE_"),
      liveScoreCoefficientPermilRaw: Number(row.liveScoreCoefficientPermil),
      singleLiveScoreEvaluationRankGroupId: row.singleLiveScoreEvaluationRankGroupId,
      multiLiveScoreEvaluationRankGroupId: row.multiLiveScoreEvaluationRankGroupId,
      comboGroupId: row.liveComboGroupId,
      scoreRatingEligible: Boolean(row.isHighestScoreRatingTarget),
      singerType: enumSuffix(row.musicSingerType, "MUSIC_SINGER_TYPE_"),
      singerTalentIds: [...(row.characterIds ?? [])],
      chorusRange:
        row.chorusStartMillisecond === undefined || row.chorusEndMillisecond === undefined
          ? null
          : {
              startMilliseconds: Number(row.chorusStartMillisecond),
              endMilliseconds: Number(row.chorusEndMillisecond),
            },
      releaseTypeRaw: row.releaseType,
      startTimeEpochMilliseconds: Number(row.startTime),
      order: Number(row.order),
      source: sourceStamp("Music.json", record.id),
      titleSource: sourceStamp("LangMusic_Eng.json", titleRecord.id),
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const songById = new Map(songs.map((song) => [song.id, song]));
const difficultyRows = new Map(
  fetched["MusicDifficulty.json"].map((record) => {
    const difficulty = enumSuffix(record.data.difficultyType, "MUSIC_DIFFICULTY_TYPE_");
    return [`${record.data.musicId}:${difficulty}`, record];
  }),
);
const difficultyConfigurationRows = new Map(
  fetched["MusicDifficultyConfiguration.json"].map((record) => [
    enumSuffix(record.data.type, "MUSIC_DIFFICULTY_TYPE_"),
    record,
  ]),
);
const difficultyOrder = new Map([
  ["easy", 1],
  ["normal", 2],
  ["hard", 3],
  ["expert", 4],
]);

const charts = fetched["MusicDifficultyChart.json"]
  .map((aggregateRecord) => {
    const aggregate = aggregateRecord.data;
    const difficulty = enumSuffix(aggregate.difficultyType, "MUSIC_DIFFICULTY_TYPE_");
    const key = `${aggregate.musicId}:${difficulty}`;
    const difficultyRecord = difficultyRows.get(key);
    const configurationRecord = difficultyConfigurationRows.get(difficulty);
    assert(songById.has(aggregate.musicId), `Chart ${key} references a missing song`);
    assert(difficultyRecord, `Missing MusicDifficulty row for ${key}`);
    assert(configurationRecord, `Missing difficulty configuration for ${difficulty}`);
    return {
      fidelity: "aggregate",
      key,
      songId: aggregate.musicId,
      difficulty,
      level: Number(difficultyRecord.data.difficultyLevel),
      chartAssetId: difficultyRecord.data.chartAssetId,
      chartHash: aggregate.chartHash,
      fullComboNoteCount: Number(aggregate.fullComboNoteCount),
      normalNoteCount: Number(aggregate.normalNoteCount),
      maxComboCountRewardThreshold: Number(aggregate.maxComboCountRewardThreshold),
      animationComboInterval: Number(configurationRecord.data.animationComboInterval),
      sources: {
        difficulty: sourceStamp(
          "MusicDifficulty.json",
          `${difficultyRecord.music_id}:${difficultyRecord.difficulty_type}`,
        ),
        aggregate: sourceStamp(
          "MusicDifficultyChart.json",
          `${aggregateRecord.music_id}:${aggregateRecord.difficulty_type}`,
        ),
        configuration: sourceStamp(
          "MusicDifficultyConfiguration.json",
          configurationRecord.type,
        ),
      },
    };
  })
  .sort(
    (left, right) =>
      left.songId.localeCompare(right.songId) ||
      difficultyOrder.get(left.difficulty) - difficultyOrder.get(right.difficulty),
  );

const noteJudgements = fetched["LiveNote.json"]
  .map((record) => {
    const row = record.data;
    const noteType = enumSuffix(row.noteType, "LIVE_NOTE_TYPE_");
    const judgement = enumSuffix(row.judgementType, "LIVE_NOTE_JUDGEMENT_TYPE_");
    return {
      key: `${noteType}:${judgement}`,
      playMode: judgement === "auto" ? "auto" : "manual",
      noteType,
      judgement,
      acceptableBeforeFrameCount: nullableNumber(row.acceptableBeforeFrameCount),
      acceptableAfterFrameCount: nullableNumber(row.acceptableAfterFrameCount),
      lifeReductionQuantity: nullableNumber(row.lifeReductionQuantity),
      scoreCoefficientPermilMultiply: nullableNumber(row.scoreCoefficientPermilMultiply),
      pcScoreCoefficientPermilMultiply: nullableNumber(row.pcScoreCoefficientPermilMultiply),
      feverPoint: nullableNumber(row.feverPoint),
      creativeChartDifficultyWeightPermil: nullableNumber(
        row.musicCreativeChartDifficultyWeightPermil,
      ),
      source: sourceStamp("LiveNote.json", `${record.note_type}:${record.judgement_type}`),
    };
  })
  .sort(
    (left, right) =>
      left.noteType.localeCompare(right.noteType) || left.judgement.localeCompare(right.judgement),
  );

const technicalJudgementScores = fetched["LiveNoteJudgementTechnicalScore.json"]
  .map((record) => ({
    judgement: enumSuffix(
      record.data.liveNoteJudgementType,
      "LIVE_NOTE_JUDGEMENT_TYPE_",
    ),
    score: nullableNumber(record.data.score),
    source: sourceStamp(
      "LiveNoteJudgementTechnicalScore.json",
      record.live_note_judgement_type,
    ),
  }))
  .sort((left, right) => left.judgement.localeCompare(right.judgement));

const comboBonuses = fetched["LiveCombo.json"]
  .map((record) => ({
    groupId: record.data.groupId,
    comboCountFrom: Number(record.combo_count_from),
    scoreUpPermil:
      record.data.scoreUpPermil === undefined ? null : Number(record.data.scoreUpPermil),
    source: sourceStamp(
      "LiveCombo.json",
      `${record.group_id}:${record.combo_count_from}`,
    ),
  }))
  .sort((left, right) => left.comboCountFrom - right.comboCountFrom);

function deckRankType(value) {
  return enumSuffix(value, "LIVE_DECK_RANK_TYPE_");
}

function evaluationRankType(value) {
  return enumSuffix(value, "LIVE_EVALUATION_RANK_TYPE_");
}

const deckEvaluationBonusRanks = fetched["LiveDeckEvaluationBonusRank.json"]
  .map((record) => ({
    type: deckRankType(record.data.type),
    plus: Number(record.data.plus ?? 0),
    thresholdPermilUp: Number(record.data.thresholdPermilUp ?? 0),
    source: sourceStamp(
      "LiveDeckEvaluationBonusRank.json",
      `${record.type}:${record.plus}`,
    ),
  }))
  .sort(
    (left, right) =>
      left.thresholdPermilUp - right.thresholdPermilUp || left.plus - right.plus,
  );

const deckEvaluationRanks = fetched["LiveDeckEvaluationRank.json"]
  .map((record) => ({
    type: deckRankType(record.data.type),
    plus: Number(record.data.plus ?? 0),
    threshold: nullableNumber(record.data.threshold),
    order: Number(record.data.order),
    source: sourceStamp("LiveDeckEvaluationRank.json", `${record.type}:${record.plus}`),
  }))
  .sort((left, right) => left.order - right.order);

const deckPowerRanks = fetched["LiveDeckPowerRank.json"]
  .map((record) => ({
    type: deckRankType(record.data.type),
    plus: Number(record.data.plus ?? 0),
    threshold: nullableNumber(record.data.threshold),
    source: sourceStamp("LiveDeckPowerRank.json", `${record.type}:${record.plus}`),
  }))
  .sort(
    (left, right) =>
      (left.threshold ?? Number.NEGATIVE_INFINITY) -
        (right.threshold ?? Number.NEGATIVE_INFINITY) || left.plus - right.plus,
  );

const scoreEvaluationRanks = fetched["LiveScoreEvaluationRank.json"]
  .map((record) => ({
    groupId: record.data.groupId,
    type: evaluationRankType(record.data.evaluationRankType),
    plus: Number(record.data.plus ?? 0),
    score: nullableNumber(record.data.score),
    source: sourceStamp(
      "LiveScoreEvaluationRank.json",
      `${record.group_id}:${record.evaluation_rank_type}:${record.plus}`,
    ),
  }))
  .sort(
    (left, right) =>
      left.groupId.localeCompare(right.groupId) ||
      (left.score ?? Number.NEGATIVE_INFINITY) -
        (right.score ?? Number.NEGATIVE_INFINITY) ||
      left.plus - right.plus,
  );

const settingRecord = fetched["Setting.json"][0];
assert(settingRecord?.data, "Setting.json did not contain its singleton row");
const setting = settingRecord.data;
const settingSource = sourceStamp("Setting.json", settingRecord.id);

const helpRows = new Map(
  fetched["HelpContent.json"].map((record) => [
    `${record.data.helpCategoryId}:${record.data.number}`,
    record,
  ]),
);
function helpSource(category, number) {
  const key = `${category}:${number}`;
  const record = helpRows.get(key);
  assert(record, `Missing help evidence row ${key}`);
  return sourceStamp("HelpContent.json", key);
}

const rules = {
  noteJudgements,
  technicalJudgementScores,
  comboBonuses,
  deckEvaluationBonusRanks,
  deckEvaluationRanks,
  deckPowerRanks,
  scoreEvaluationRanks,
  life: {
    maximum: Number(setting.liveMaxLife),
    warningThreshold: Number(setting.liveWarningLifeThreshold),
    badAndMissReduceLife: true,
    liveEndsAtZero: true,
    sources: [settingSource, helpSource("help_category-help-rhythm", 4)],
  },
  manualLive: {
    comboContinuesAtOrAbove: "great",
    comboBreaksOn: ["good", "bad", "miss"],
    scoreDependsOnJudgementAndCombo: true,
    source: helpSource("help_category-help-rhythm", 3),
  },
  autoLive: {
    usesAutoJudgementRows: true,
    lowerMultiplierThanManual: true,
    comboScoreBonusEnabled: false,
    judgmentScoreDisplayed: false,
    judgmentBoostCanChangeAutoJudgement: false,
    lifeRestoreEnabled: false,
    sources: [
      helpSource("help_category-help-rhythm", 12),
      helpSource("help_category-faq-live", 1),
      helpSource("help_category-faq-live", 2),
    ],
  },
  rating: {
    aggregationSongCount: Number(setting.musicHighestScoreRatingAggregationMusicCount),
    valueDenominator: Number(setting.musicHighestScoreRatingValueDenominator),
    scoreIsHighestAcrossDifficulties: true,
    requiresTalentAsLeader: true,
    steamEligible: false,
    sources: [settingSource, helpSource("help_category-help-rhythm", 6), helpSource("help_category-help-rhythm", 7)],
  },
  live: {
    leaderCount: 1,
    memberCount: 5,
    specialUsesPerLive: 1,
    specialOrder: "formation-order",
    activeActivation: "random-at-intervals",
    passiveActivation: "constant-when-conditions-met",
    musicStartIdleTimeMilliseconds: Number(setting.liveMusicStartIdleTimeMilliseconds),
    sources: [settingSource, helpSource("help_category-help-rhythm", 2), helpSource("help_category-help-card", 2)],
  },
  scoreConstants: {
    deckEvaluationCoefficientPermilMultiply: Number(
      setting.liveDeckEvaluationCoefficientPermilMultiply,
    ),
    deckPowerCoefficientPermilMultiply: Number(setting.liveDeckPowerCoefficientPermilMultiply),
    longNoteCountForContinuation: Number(setting.liveLongNoteCountForContinuation),
    longNoteEndAcceptableWindowMilliseconds: Number(
      setting.liveLongNoteEndAcceptableWindowMilliseconds,
    ),
    longRelayAcceptableWindowMilliseconds: Number(
      setting.liveLongRelayAcceptableWindowMilliseconds,
    ),
    damageNoteInvincibilityTimeMilliseconds: Number(
      setting.liveDamageNoteInvincibilityTimeMilliseconds,
    ),
    resultNoteCountTolerance: Number(setting.liveResultNoteCountTolerance),
    source: settingSource,
  },
};

const expertCharts = charts.filter(
  (chart) => chart.difficulty === "expert" && songById.get(chart.songId).scoreRatingEligible,
);
const medianDuration = median(
  expertCharts.map((chart) => songById.get(chart.songId).playingMilliseconds),
);
const medianDensity = median(
  expertCharts.map(
    (chart) =>
      chart.fullComboNoteCount /
      (songById.get(chart.songId).playingMilliseconds / 1_000),
  ),
);
const fixedCompactIds = new Set(["m0206", "m0121", "m0131", "m0303", "m0321"]);
const medianChart = expertCharts
  .filter((chart) => !fixedCompactIds.has(chart.songId))
  .map((chart) => {
    const song = songById.get(chart.songId);
    const density = chart.fullComboNoteCount / (song.playingMilliseconds / 1_000);
    return {
      chart,
      distance:
        Math.abs(song.playingMilliseconds - medianDuration) / medianDuration +
        Math.abs(density - medianDensity) / medianDensity,
    };
  })
  .sort(
    (left, right) =>
      left.distance - right.distance || left.chart.key.localeCompare(right.chart.key),
  )[0].chart;

const compactFixtures = [
  ["m0206:expert", "short-duration-baseline"],
  ["m0121:expert", "short-dense"],
  [medianChart.key, "median-duration-and-density"],
  ["m0131:expert", "long-sparse"],
  ["m0303:expert", "long-dense"],
  ["m0321:expert", "extreme-density"],
];
const chartByKey = new Map(charts.map((chart) => [chart.key, chart]));
const corpusEntry = ([chartKey, reason]) => {
  const chart = chartByKey.get(chartKey);
  assert(chart, `Corpus references missing chart ${chartKey}`);
  return { chartKey, expectedChartHash: chart.chartHash, reason };
};

assert(songs.length === 194, `Expected 194 songs, received ${songs.length}`);
assert(charts.length === 776, `Expected 776 aggregate charts, received ${charts.length}`);
assert(noteJudgements.length === 38, `Expected 38 LiveNote rules, received ${noteJudgements.length}`);
assert(comboBonuses.length === 11, `Expected 11 combo rules, received ${comboBonuses.length}`);
assert(
  deckEvaluationBonusRanks.length === 14,
  `Expected 14 deck evaluation bonus ranks, received ${deckEvaluationBonusRanks.length}`,
);
assert(
  deckEvaluationRanks.length === 14,
  `Expected 14 deck evaluation ranks, received ${deckEvaluationRanks.length}`,
);
assert(
  deckPowerRanks.length === 14,
  `Expected 14 deck power ranks, received ${deckPowerRanks.length}`,
);
assert(
  scoreEvaluationRanks.length === 28,
  `Expected 28 score evaluation ranks, received ${scoreEvaluationRanks.length}`,
);
assert(
  songs.every(
    (song) => charts.filter((chart) => chart.songId === song.id).length === 4,
  ),
  "Every song must have exactly four aggregate difficulty charts",
);

const payload = {
  schemaVersion: 1,
  methodologyVersion: transformVersion,
  retrievedAt,
  sourceSnapshot: {
    ...sourceSnapshot,
    files: sourceFiles,
    transformation: "Explicit Music, difficulty, aggregate-chart, Live rule, rank-threshold, Setting, and English-language joins by upstream row keys.",
  },
  evidenceSources: [
    {
      id: "holodori-structured-song-snapshot",
      url: `${sourceSnapshot.repository}/tree/${sourceSnapshot.commit}`,
      role: "pinned-structured-input",
    },
    {
      id: "hololive-dreams-official-system",
      url: "https://www.hololive-dreams.com/en/system",
      role: "official-mechanics-corroboration",
    },
    {
      id: "game8-formation-order",
      url: "https://game8.jp/hololive-dreams/801512",
      role: "independent-formation-order-corroboration",
    },
  ],
  counts: {
    songs: songs.length,
    aggregateCharts: charts.length,
    timedCharts: 0,
    ratingEligibleSongs: songs.filter((song) => song.scoreRatingEligible).length,
  },
  validation: {
    chartTimeline: "unavailable",
    runtimeScoreEquation: "unvalidated",
    absoluteScoreClaimsAllowed: false,
    exactPerSongOptimizationClaimsAllowed: false,
  },
  songs,
  charts,
  timedCharts: [],
  rules,
  corpora: {
    full: {
      id: `full-${sourceSnapshot.commit.slice(0, 12)}`,
      entries: charts.map((chart) => corpusEntry([chart.key, "full-pinned-chart-corpus"])),
    },
    compact: {
      id: `compact-${sourceSnapshot.commit.slice(0, 12)}`,
      entries: compactFixtures.map(corpusEntry),
    },
  },
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Normalized ${payload.counts.songs} songs, ${payload.counts.aggregateCharts} aggregate charts, ${payload.rules.noteJudgements.length} judgment rows, and ${payload.rules.scoreEvaluationRanks.length} score-rank rows from ${sourceSnapshot.commit}.`,
);
