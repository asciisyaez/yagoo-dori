import { describe, expect, it } from "vitest";

import {
  NativeRankingBenchmarkConfigSchema,
  buildNativeRankingBenchmarkContexts,
  frozenCohortCardIds,
  loadNativeRankingBenchmarkConfig,
  nativeRankingBenchmark,
  nativeRankingBenchmarkValidationStats,
} from "./native-ranking-benchmark";
import { publicCardById, publicCards } from "./public-data";

describe("frozen native ranking benchmark", () => {
  it("pins the exact 113-card launch cohort and 21:9 Expert chart corpus", () => {
    expect(frozenCohortCardIds).toHaveLength(113);
    expect(new Set(frozenCohortCardIds).size).toBe(113);
    expect(frozenCohortCardIds).toEqual([...frozenCohortCardIds].sort());
    expect(frozenCohortCardIds.every((cardId) => publicCardById.has(cardId))).toBe(true);

    expect(nativeRankingBenchmark.corpus.reference).toHaveLength(21);
    expect(nativeRankingBenchmark.corpus.current).toHaveLength(9);
    expect(
      [...nativeRankingBenchmark.corpus.reference, ...nativeRankingBenchmark.corpus.current].every(
        (entry) => entry.chartKey.endsWith(":expert"),
      ),
    ).toBe(true);
    expect(nativeRankingBenchmarkValidationStats.charts).toEqual({
      total: 30,
      reference: 21,
      current: 9,
    });
  });

  it("derives the same frozen contexts on every run", () => {
    const first = buildNativeRankingBenchmarkContexts();
    const second = buildNativeRankingBenchmarkContexts();

    expect(second).toEqual(first);
    expect(new Set(first.memberContexts.map((context) => context.id)).size).toBe(300);
    expect(new Set(first.leaderContexts.map((context) => context.id)).size).toBe(300);
  });

  it("creates 300 contexts of each type with ten per chart and a 70:30 mix", () => {
    const { memberContexts, leaderContexts } = buildNativeRankingBenchmarkContexts();
    expect(memberContexts).toHaveLength(300);
    expect(leaderContexts).toHaveLength(300);

    const expectedChartKeys = [
      ...nativeRankingBenchmark.corpus.reference.map((entry) => entry.chartKey),
      ...nativeRankingBenchmark.corpus.current.map((entry) => entry.chartKey),
    ];
    for (const chartKey of expectedChartKeys) {
      expect(memberContexts.filter((context) => context.chartKey === chartKey)).toHaveLength(10);
      expect(leaderContexts.filter((context) => context.chartKey === chartKey)).toHaveLength(10);
    }
    for (const contexts of [memberContexts, leaderContexts]) {
      expect(contexts.filter((context) => context.segment === "reference")).toHaveLength(210);
      expect(contexts.filter((context) => context.segment === "current")).toHaveLength(90);
      expect(contexts.reduce((sum, context) => sum + context.weight, 0)).toBe(300);
    }
  });

  it("keeps every Member formation legal and ordered", () => {
    const { memberContexts, leaderContexts } = buildNativeRankingBenchmarkContexts();
    for (const context of memberContexts) {
      expect(context.partnerCardIds).toHaveLength(4);
      expect(new Set(context.partnerCardIds).size).toBe(4);
      expect(
        new Set(context.partnerCardIds.map((cardId) => publicCardById.get(cardId)!.talentId)).size,
      ).toBe(4);
      expect(frozenCohortCardIds).toContain(context.leaderOutfitCardId);
    }
    for (const context of leaderContexts) {
      expect(context.memberCardIds).toHaveLength(5);
      expect(new Set(context.memberCardIds).size).toBe(5);
      expect(
        new Set(context.memberCardIds.map((cardId) => publicCardById.get(cardId)!.talentId)).size,
      ).toBe(5);
    }
  });

  it("balances insertion slots and every frozen-card exposure", () => {
    const { memberContexts } = buildNativeRankingBenchmarkContexts();
    const perSlot = [0, 1, 2, 3, 4].map(
      (slot) => memberContexts.filter((context) => context.insertionSlot === slot).length,
    );
    expect(perSlot).toEqual([60, 60, 60, 60, 60]);
    for (const chart of nativeRankingBenchmark.corpus.reference.concat(
      nativeRankingBenchmark.corpus.current,
    )) {
      const chartSlots = [0, 1, 2, 3, 4].map(
        (slot) =>
          memberContexts.filter(
            (context) => context.chartKey === chart.chartKey && context.insertionSlot === slot,
          ).length,
      );
      expect(chartSlots).toEqual([2, 2, 2, 2, 2]);
    }

    expect(nativeRankingBenchmarkValidationStats.exposure.memberPartners).toEqual({
      minimum: 10,
      maximum: 11,
      covered: 113,
    });
    expect(nativeRankingBenchmarkValidationStats.exposure.memberContextLeaders).toEqual({
      minimum: 2,
      maximum: 3,
      covered: 113,
    });
    expect(nativeRankingBenchmarkValidationStats.exposure.leaderContextMembers).toEqual({
      minimum: 13,
      maximum: 14,
      covered: 113,
    });
  });

  it("ignores appended future cards but hard-fails a missing frozen card", () => {
    const baseline = buildNativeRankingBenchmarkContexts();
    const template = publicCards[0]!;
    const expandedRoster = [
      ...publicCards,
      { ...template, id: "card-99999-5-uniq-9999-00", talentId: "chr-99999" },
    ];

    expect(buildNativeRankingBenchmarkContexts(expandedRoster)).toEqual(baseline);
    expect(() =>
      buildNativeRankingBenchmarkContexts(
        publicCards.filter((card) => card.id !== frozenCohortCardIds[0]),
      ),
    ).toThrow(`Frozen benchmark cohort card is missing: ${frozenCohortCardIds[0]}`);
  });

  it("admits reviewed future cards only into versioned current partner cores", () => {
    const base = buildNativeRankingBenchmarkContexts();
    const template = publicCards[0]!;
    const futureCard = {
      ...template,
      id: "card-99999-5-uniq-9999-00",
      talentId: "chr-99999",
    };
    const extended = buildNativeRankingBenchmarkContexts(
      [...publicCards, futureCard],
      { version: "roster-2026-08-01", appendedCardIds: [futureCard.id] },
    );

    expect(
      extended.memberContexts.filter((context) => context.segment === "reference"),
    ).toEqual(base.memberContexts.filter((context) => context.segment === "reference"));
    expect(
      extended.leaderContexts.filter((context) => context.segment === "reference"),
    ).toEqual(base.leaderContexts.filter((context) => context.segment === "reference"));
    expect(
      extended.memberContexts.filter((context) =>
        context.partnerCardIds.includes(futureCard.id),
      ),
    ).toHaveLength(3);
    expect(
      extended.leaderContexts.filter((context) =>
        context.memberCardIds.includes(futureCard.id),
      ),
    ).toHaveLength(3);
    expect(
      extended.memberContexts.filter(
        (context) => context.leaderOutfitCardId === futureCard.id,
      ),
    ).toHaveLength(1);
    expect(
      extended.memberContexts
        .filter((context) => context.segment === "current")
        .every((context) => context.id.endsWith(":current-extension:roster-2026-08-01")),
    ).toBe(true);
    expect(
      extended.memberContexts
        .filter((context) => context.segment === "reference")
        .some((context) =>
          context.partnerCardIds.includes(futureCard.id) ||
          context.leaderOutfitCardId === futureCard.id,
        ),
    ).toBe(false);
  });

  it("rejects cohort, chart, mix, and malformed source pins", () => {
    const cohortDrift = structuredClone(nativeRankingBenchmark);
    cohortDrift.cohort.orderedCardIds[0] = "card-drift";
    expect(NativeRankingBenchmarkConfigSchema.safeParse(cohortDrift).success).toBe(false);

    const chartDrift = structuredClone(nativeRankingBenchmark);
    chartDrift.corpus.reference[0]!.expectedChartHash = "0".repeat(32);
    expect(NativeRankingBenchmarkConfigSchema.safeParse(chartDrift).success).toBe(false);

    const mixDrift = structuredClone(nativeRankingBenchmark);
    Object.assign(mixDrift.corpus, { referenceSharePermil: 699, currentSharePermil: 301 });
    expect(NativeRankingBenchmarkConfigSchema.safeParse(mixDrift).success).toBe(false);

    const malformedSource = structuredClone(nativeRankingBenchmark);
    malformedSource.sources.roster.commit = "not-a-commit";
    expect(() => loadNativeRankingBenchmarkConfig(malformedSource)).toThrow();
  });

  it("does not couple frozen benchmark provenance to the current import commit", () => {
    const historicPin = structuredClone(nativeRankingBenchmark);
    historicPin.sources.roster.commit = "0".repeat(40);
    historicPin.sources.charts.commit = "0".repeat(40);

    expect(loadNativeRankingBenchmarkConfig(historicPin).cohort).toEqual(
      nativeRankingBenchmark.cohort,
    );
  });
});
