import { describe, expect, it } from "vitest";

import {
  DataBundleSchema,
  DatasetManifestSchema,
  MemberCardSchema,
  ReviewQueueRecordSchema,
  TeamGuideSchema,
  validateBundle,
} from "./index";

describe("domain validation", () => {
  it("rejects progression curves that do not increase by level", () => {
    const result = MemberCardSchema.safeParse({
      id: "card-bad",
      slug: "card-bad",
      title: "Bad fixture",
      talentId: "talent-a",
      rarity: 5,
      type: "vocal",
      generation: "Preview",
      patchId: "patch-preview",
      skillIds: ["skill-a"],
      synergyTags: ["vocal"],
      progression: [
        { stage: 2, investment: 0.5, power: 100 },
        { stage: 1, investment: 0, power: 90 },
      ],
      sourceIds: ["source-a"],
      retrievedAt: "2026-07-29",
      verificationState: "research-only",
      confidence: 0.4,
      illustrative: true,
      artAssetId: null,
    });

    expect(result.success).toBe(false);
  });

  it("requires exactly five unique Member slots per formation", () => {
    const baseGuide = {
      id: "guide-a",
      slug: "guide-a",
      title: "Guide",
      anchorCardId: "card-a",
      leaderOutfitId: "leader-a",
      patchId: "patch-preview",
      evidenceGrade: "research-only",
      assumptions: ["Fixture"],
      skillTiming: "Fixture timing",
      chartFit: ["balanced"],
      investmentOrder: ["card-a"],
      sourceIds: ["source-a"],
      retrievedAt: "2026-07-29",
      verificationState: "research-only",
      confidence: 0.4,
      illustrative: true,
      changelog: [{ date: "2026-07-29", note: "Created" }],
      formations: [
        {
          label: "standard",
          cardIds: ["card-a", "card-a", "card-b", "card-c", "card-d"],
          projectedScore: 100,
          replacementLoss: 0,
          notes: "Fixture",
        },
      ],
    };

    expect(TeamGuideSchema.safeParse(baseGuide).success).toBe(false);
  });

  it("reports duplicate IDs and missing references without silently resolving them", () => {
    const result = validateBundle(
      DataBundleSchema.parse({
        sources: [
          {
            id: "source-a",
            title: "Source",
            publisher: "Publisher",
            url: "https://example.com/source",
            kind: "official",
            reusePolicy: "facts-only",
            upstreamVersion: "1",
            retrievedAt: "2026-07-29",
            verificationState: "verified",
            confidence: 1,
            notes: "Fixture",
          },
        ],
        assets: [],
        patches: [
          {
            id: "patch-preview",
            label: "Preview",
            releasedAt: "2026-07-29",
            sourceIds: ["source-a"],
            verificationState: "research-only",
            confidence: 0.4,
            illustrative: true,
          },
        ],
        talents: [
          {
            id: "talent-a",
            slug: "talent-a",
            name: "Talent A",
            branch: "Preview",
            generation: "Preview",
            sourceIds: ["source-a"],
            retrievedAt: "2026-07-29",
            verificationState: "research-only",
            confidence: 0.4,
            illustrative: true,
          },
          {
            id: "talent-a",
            slug: "talent-b",
            name: "Talent B",
            branch: "Preview",
            generation: "Preview",
            sourceIds: ["source-a"],
            retrievedAt: "2026-07-29",
            verificationState: "research-only",
            confidence: 0.4,
            illustrative: true,
          },
        ],
        skills: [],
        cards: [],
        leaders: [],
        guides: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Duplicate talents id talent-a"))).toBe(true);
  });

  it("keeps illustrative records out of the production-ready set", async () => {
    const { researchBundle, getPublicationReadiness } = await import("./index");
    const readiness = getPublicationReadiness(researchBundle);

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("All Member-card records are illustrative research fixtures.");
  });

  it("keeps unresolved numerical disagreements open instead of accepting a silent resolution", () => {
    const result = ReviewQueueRecordSchema.safeParse({
      id: "review-a",
      entityId: "card-a",
      field: "power",
      status: "open",
      claims: [{ value: 120, sourceId: "source-a" }],
      resolution: {
        value: 120,
        sourceId: "source-a",
        rationale: "Chosen without review",
        resolvedAt: "2026-07-29",
      },
      notes: "Conflict fixture",
    });

    expect(result.success).toBe(false);
  });

  it("cannot call a launch dataset complete without permitted expected counts", () => {
    const result = DatasetManifestSchema.safeParse({
      id: "dataset-a",
      patchId: "patch-a",
      scope: "All launch cards",
      expectedCounts: { fourStar: null, fiveStar: null, total: null },
      observedCounts: { fourStar: 4, fiveStar: 4, total: 8 },
      sourceIds: ["source-a"],
      retrievedAt: "2026-07-29",
      verificationState: "research-only",
      complete: true,
      notes: "Fixture",
    });

    expect(result.success).toBe(false);
  });
});
