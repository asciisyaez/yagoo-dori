import { describe, expect, it } from "vitest";

import {
  ChartContextSchema,
  SongContextDataSchema,
  TimedChartContextSchema,
  assertExactSongClaimsAllowed,
  calculateActiveIntervalBreakpoints,
  calculateSpecialOrderBreakpoints,
  chartClaimCapabilities,
  ratingSongsForTalent,
  selectCompactChartCorpus,
  selectFullChartCorpus,
  songContextData,
} from "./song-contexts";

const PINNED_COMMIT = "1907a1b9f85beb22e9d255686a26e0bd5db223e9";

describe("evidence-backed song and chart contexts", () => {
  it("loads the complete pinned song and aggregate-chart snapshot", () => {
    expect(songContextData.sourceSnapshot.commit).toBe(PINNED_COMMIT);
    expect(songContextData.counts).toEqual({
      songs: 177,
      aggregateCharts: 708,
      timedCharts: 0,
      ratingEligibleSongs: 163,
    });
    expect(songContextData.songs).toHaveLength(177);
    expect(songContextData.charts).toHaveLength(708);
    expect(new Set(songContextData.songs.map((song) => song.id)).size).toBe(177);
    expect(new Set(songContextData.charts.map((chart) => chart.key)).size).toBe(708);
    expect(songContextData.charts.every((chart) => chart.fidelity === "aggregate")).toBe(true);
    expect(SongContextDataSchema.safeParse(songContextData).success).toBe(true);
  });

  it("preserves row-level provenance and four difficulties per song", () => {
    for (const song of songContextData.songs) {
      expect(song.source).toMatchObject({
        commit: PINNED_COMMIT,
        table: "Music.json",
        rowKey: song.id,
      });
      expect("attribute" in song).toBe(false);

      const charts = songContextData.charts.filter((chart) => chart.songId === song.id);
      expect(charts.map((chart) => chart.difficulty).sort()).toEqual([
        "easy",
        "expert",
        "hard",
        "normal",
      ]);
      for (const chart of charts) {
        expect(chart.sources.difficulty.commit).toBe(PINNED_COMMIT);
        expect(chart.sources.aggregate.commit).toBe(PINNED_COMMIT);
        expect(chart.sources.configuration.commit).toBe(PINNED_COMMIT);
        expect(chart.chartHash).toMatch(/^[a-f0-9]{32}$/);
      }
    }
  });

  it("catalogues the exact structured judgment, combo, Life, Auto, and rating rules", () => {
    expect(songContextData.rules.noteJudgements).toHaveLength(38);
    expect(songContextData.rules.noteJudgements.filter((row) => row.playMode === "auto")).toHaveLength(8);
    expect(songContextData.rules.noteJudgements.filter((row) => row.playMode === "manual")).toHaveLength(30);
    expect(songContextData.rules.technicalJudgementScores).toHaveLength(7);
    expect(songContextData.rules.comboBonuses).toHaveLength(11);

    expect(songContextData.rules.life).toMatchObject({
      maximum: 1_000,
      warningThreshold: 300,
    });
    expect(songContextData.rules.rating).toMatchObject({
      aggregationSongCount: 3,
      valueDenominator: 5_000,
      scoreIsHighestAcrossDifficulties: true,
      requiresTalentAsLeader: true,
      steamEligible: false,
    });
    expect(songContextData.rules.autoLive).toMatchObject({
      usesAutoJudgementRows: true,
      comboScoreBonusEnabled: false,
      judgmentScoreDisplayed: false,
    });

    const normalPerfect = songContextData.rules.noteJudgements.find(
      (row) => row.noteType === "normal" && row.judgement === "perfect",
    );
    expect(normalPerfect).toMatchObject({
      playMode: "manual",
      scoreCoefficientPermilMultiply: 1_000,
      pcScoreCoefficientPermilMultiply: 1_000,
    });
    const normalAuto = songContextData.rules.noteJudgements.find(
      (row) => row.noteType === "normal" && row.judgement === "auto",
    );
    expect(normalAuto).toMatchObject({
      playMode: "auto",
      scoreCoefficientPermilMultiply: 800,
      pcScoreCoefficientPermilMultiply: 800,
    });
    expect(songContextData.rules.comboBonuses.at(-1)).toMatchObject({
      comboCountFrom: 1_000,
      scoreUpPermil: 100,
    });
  });

  it("preserves deck and score evaluation rank thresholds without deriving a score equation", () => {
    expect(songContextData.sourceSnapshot.files).toEqual(
      expect.arrayContaining([
        "LiveDeckEvaluationBonusRank.json",
        "LiveDeckEvaluationRank.json",
        "LiveDeckPowerRank.json",
        "LiveScoreEvaluationRank.json",
      ]),
    );
    expect(songContextData.rules.deckEvaluationBonusRanks).toHaveLength(14);
    expect(songContextData.rules.deckEvaluationRanks).toHaveLength(14);
    expect(songContextData.rules.deckPowerRanks).toHaveLength(14);
    expect(songContextData.rules.scoreEvaluationRanks).toHaveLength(28);

    expect(
      songContextData.rules.deckEvaluationBonusRanks.map(
        (row) => `${row.type}${row.plus}:${row.thresholdPermilUp}`,
      ),
    ).toEqual([
      "d0:0",
      "d1:400",
      "c0:500",
      "c1:600",
      "b0:700",
      "b1:800",
      "a0:1000",
      "a1:1100",
      "s0:1300",
      "s1:1400",
      "s2:1500",
      "s3:1650",
      "s4:1800",
      "s5:2000",
    ]);
    expect(
      songContextData.rules.deckEvaluationRanks.map(
        (row) => `${row.type}${row.plus}:${row.threshold ?? "null"}:${row.order}`,
      ),
    ).toEqual([
      "d0:null:1",
      "d1:100000:2",
      "c0:150000:3",
      "c1:220000:4",
      "b0:300000:5",
      "b1:450000:6",
      "a0:600000:7",
      "a1:800000:8",
      "s0:1000000:9",
      "s1:1200000:10",
      "s2:1500000:11",
      "s3:2000000:12",
      "s4:2500000:13",
      "s5:3000000:14",
    ]);
    expect(
      songContextData.rules.deckPowerRanks.map(
        (row) => `${row.type}${row.plus}:${row.threshold ?? "null"}`,
      ),
    ).toEqual([
      "d0:null",
      "d1:30000",
      "c0:50000",
      "c1:70000",
      "b0:100000",
      "b1:120000",
      "a0:150000",
      "a1:170000",
      "s0:200000",
      "s1:220000",
      "s2:270000",
      "s3:300000",
      "s4:350000",
      "s5:400000",
    ]);

    const expectedScoreThresholds = [
      null,
      150_000,
      300_000,
      600_000,
      1_000_000,
      1_200_000,
      1_500_000,
      2_000_000,
      2_500_000,
      3_000_000,
      3_500_000,
      4_000_000,
      4_500_000,
      5_000_000,
    ];
    expect(
      songContextData.rules.scoreEvaluationRanks
        .filter((row) => row.groupId === "live_score_rank-s001")
        .map((row) => row.score),
    ).toEqual(expectedScoreThresholds);
    expect(
      songContextData.rules.scoreEvaluationRanks
        .filter((row) => row.groupId === "live_score_rank-m001")
        .map((row) => row.score),
    ).toEqual(expectedScoreThresholds.map((score) => (score === null ? null : score * 5)));

    expect(songContextData.rules.deckEvaluationBonusRanks[0]).toMatchObject({
      type: "d",
      plus: 0,
      thresholdPermilUp: 0,
      source: {
        commit: PINNED_COMMIT,
        table: "LiveDeckEvaluationBonusRank.json",
        rowKey: "1:0",
      },
    });
    expect(songContextData.rules.deckEvaluationBonusRanks.at(-1)).toMatchObject({
      type: "s",
      plus: 5,
      thresholdPermilUp: 2_000,
    });

    expect(songContextData.rules.deckEvaluationRanks[0]).toMatchObject({
      type: "d",
      plus: 0,
      threshold: null,
      order: 1,
    });
    expect(songContextData.rules.deckEvaluationRanks.at(-1)).toMatchObject({
      type: "s",
      plus: 5,
      threshold: 3_000_000,
      order: 14,
    });
    expect(songContextData.rules.deckPowerRanks[0]).toMatchObject({
      type: "d",
      plus: 0,
      threshold: null,
    });
    expect(songContextData.rules.deckPowerRanks.at(-1)).toMatchObject({
      type: "s",
      plus: 5,
      threshold: 400_000,
    });

    const singleD = songContextData.rules.scoreEvaluationRanks.find(
      (row) => row.groupId === "live_score_rank-s001" && row.type === "d",
    );
    expect(singleD).toMatchObject({ plus: 0, score: null });
    const multiS9 = songContextData.rules.scoreEvaluationRanks.find(
      (row) =>
        row.groupId === "live_score_rank-m001" && row.type === "s" && row.plus === 9,
    );
    expect(multiS9).toMatchObject({
      score: 25_000_000,
      source: {
        commit: PINNED_COMMIT,
        table: "LiveScoreEvaluationRank.json",
        rowKey: "live_score_rank-m001:5:9",
      },
    });

    expect(songContextData.validation.runtimeScoreEquation).toBe("unvalidated");
    expect(songContextData.validation.absoluteScoreClaimsAllowed).toBe(false);
  });

  it("derives rating-song membership from structured singer relationships", () => {
    expect(ratingSongsForTalent("chr-00013").map((song) => song.id).sort()).toEqual([
      "m0074",
      "m0141",
      "m0163",
      "m0164",
      "m0189",
      "m0303",
    ]);
    expect(ratingSongsForTalent("missing-talent")).toEqual([]);
  });

  it("selects frozen full and compact corpora by chart key and hash", () => {
    const full = selectFullChartCorpus();
    const compact = selectCompactChartCorpus();

    expect(full).toHaveLength(708);
    expect(compact).toHaveLength(6);
    expect(compact.every((entry) => entry.chart.fidelity === "aggregate")).toBe(true);
    expect(compact.every((entry) => entry.chart.difficulty === "expert")).toBe(true);
    expect(compact.map((entry) => entry.chart.songId)).toEqual([
      "m0206",
      "m0121",
      expect.any(String),
      "m0131",
      "m0303",
      "m0321",
    ]);
    expect(compact.every((entry) => entry.chart.chartHash === entry.expectedChartHash)).toBe(true);
  });

  it("never authorizes exact or absolute claims from aggregate charts", () => {
    const aggregate = songContextData.charts[0]!;
    expect(ChartContextSchema.safeParse(aggregate).success).toBe(true);
    expect(chartClaimCapabilities(aggregate, "validated")).toEqual({
      canProduceAbsoluteScore: false,
      canClaimExactPerSongOptimum: false,
      reason: "aggregate-chart-has-no-note-timeline",
    });
    expect(() => assertExactSongClaimsAllowed(aggregate, "validated")).toThrow(
      /aggregate-chart-has-no-note-timeline/,
    );
  });

  it("does not treat an empty or invented timeline as a timed chart", () => {
    const aggregate = songContextData.charts[0]!;
    expect(songContextData.timedCharts).toEqual([]);
    const result = ChartContextSchema.safeParse({
      fidelity: "timed",
      key: aggregate.key,
      songId: aggregate.songId,
      difficulty: aggregate.difficulty,
      level: aggregate.level,
      chartAssetId: aggregate.chartAssetId,
      chartHash: aggregate.chartHash,
      events: [],
      specialMarkerMilliseconds: [10_000, 20_000, 30_000, 40_000, 50_000],
      source: {
        ...aggregate.sources.aggregate,
        table: "public-timed-chart-fixture",
        rowKey: aggregate.key,
      },
    });
    expect(result.success).toBe(false);
  });

  it("calculates caller-supplied Active interval breakpoints without inventing the first check", () => {
    expect(
      calculateActiveIntervalBreakpoints(65_000, [
        { memberCardId: "azki", firstCheckMilliseconds: 20_000, cooldownMilliseconds: 20_000 },
        { memberCardId: "suisei", firstCheckMilliseconds: 29_000, cooldownMilliseconds: 29_000 },
      ]),
    ).toEqual([
      { memberCardId: "azki", checkNumber: 1, atMilliseconds: 20_000 },
      { memberCardId: "suisei", checkNumber: 1, atMilliseconds: 29_000 },
      { memberCardId: "azki", checkNumber: 2, atMilliseconds: 40_000 },
      { memberCardId: "suisei", checkNumber: 2, atMilliseconds: 58_000 },
      { memberCardId: "azki", checkNumber: 3, atMilliseconds: 60_000 },
    ]);
  });

  it("calculates order-dependent Special windows only when timed marker evidence exists", () => {
    const aggregate = songContextData.charts[0]!;
    const timed = TimedChartContextSchema.parse({
      fidelity: "timed",
      key: aggregate.key,
      songId: aggregate.songId,
      difficulty: aggregate.difficulty,
      level: aggregate.level,
      chartAssetId: aggregate.chartAssetId,
      chartHash: aggregate.chartHash,
      events: [
        {
          atMilliseconds: 1_000,
          noteType: "normal",
          comboDelta: 1,
          scoreCoefficientPermilMultiply: 1_000,
          lifeReductionOnMiss: 0,
        },
      ],
      specialMarkerMilliseconds: [8_000, 18_000, 31_000, 43_000, 55_000],
      source: aggregate.sources.aggregate,
    });
    const order = ["a", "b", "c", "d", "e"] as const;
    expect(
      calculateSpecialOrderBreakpoints(timed, order, {
        a: 12_000,
        b: 10_000,
        c: 10_000,
        d: 8_000,
        e: 10_000,
      }),
    ).toEqual([
      { slot: 1, memberCardId: "a", startsAtMilliseconds: 8_000, endsAtMilliseconds: 20_000 },
      { slot: 2, memberCardId: "b", startsAtMilliseconds: 18_000, endsAtMilliseconds: 28_000 },
      { slot: 3, memberCardId: "c", startsAtMilliseconds: 31_000, endsAtMilliseconds: 41_000 },
      { slot: 4, memberCardId: "d", startsAtMilliseconds: 43_000, endsAtMilliseconds: 51_000 },
      { slot: 5, memberCardId: "e", startsAtMilliseconds: 55_000, endsAtMilliseconds: 65_000 },
    ]);
  });
});
