import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as core from "./index";

const LEGACY_EXPORTS = [
  "researchBundle",
  "dataIndex",
  "generateResearchRanking",
  "optimizeTeam",
  "simulateTeam",
  "defaultLeader",
  "DataBundleSchema",
  "MemberCardSchema",
  "RankingSnapshotSchema",
  "validateBundle",
] as const;

const NATIVE_MODULES = [
  "native-guide-generator.ts",
  "native-guide-schema.ts",
  "native-metrics.ts",
  "native-ranking-generator.ts",
  "native-ranking-scoring.ts",
  "native-ranking-schema.ts",
  "native-search.ts",
  "native-utility.ts",
] as const;

describe("core public boundary", () => {
  it("exports only the real public/native stack and never exposes the rejected research bundle", () => {
    const exportedNames = Object.keys(core);

    for (const legacyName of LEGACY_EXPORTS) {
      expect(exportedNames).not.toContain(legacyName);
    }
    expect(exportedNames).toEqual(
      expect.arrayContaining([
        "publicCards",
        "mechanicsData",
        "songContextData",
        "evaluateFormation",
        "evaluateNativeRelativeUtility",
        "searchNativeLegalTeams",
        "generateNativeRankingSnapshot",
        "generateNativeGuideData",
      ]),
    );
    expect(core.publicCards.some((card) => /research slot|illustrative|preview/i.test(card.title))).toBe(
      false,
    );
  });

  it("contains no dependency edge from the index or native modules into the deleted synthetic stack", () => {
    const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(indexSource).not.toMatch(
      /["']\.\/(?:data|optimizer|ranking|schemas|simulator|validation)["']/,
    );
    expect(indexSource).not.toMatch(/researchBundle|research slot|patch-research-preview/);

    for (const moduleName of NATIVE_MODULES) {
      const source = readFileSync(new URL(`./${moduleName}`, import.meta.url), "utf8");
      expect(source, moduleName).not.toMatch(
        /from\s+["']\.\/(?:data|optimizer|ranking|schemas|simulator|validation)["']/,
      );
      expect(source, moduleName).not.toMatch(/researchBundle|patch-research-preview|card-[a-z]+-preview/);
    }
  });
});
