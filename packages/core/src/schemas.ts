import { z } from "zod";

export const VerificationStateSchema = z.enum([
  "verified",
  "corroborated",
  "research-only",
  "disputed",
]);

export const EvidenceFieldsSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
  retrievedAt: z.iso.date(),
  verificationState: VerificationStateSchema,
  confidence: z.number().min(0).max(1),
  illustrative: z.boolean().default(false),
});

const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case slug");

export const SourceRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  kind: z.enum(["official", "licensed-community", "independent-guide", "change-signal", "methodology", "policy"]),
  reusePolicy: z.enum(["facts-only", "licensed-data", "reference-only", "no-redistribution-without-license"]),
  upstreamVersion: z.string().min(1),
  retrievedAt: z.iso.date(),
  verificationState: VerificationStateSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string().min(1),
});

export const AssetRecordSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1).nullable(),
  kind: z.enum(["brand-mark", "card-art", "portrait", "icon", "banner", "screenshot"]),
  rightsState: z.enum(["approved", "conditional", "blocked"]),
  provenance: z.string().min(1),
  reuseBasis: z.string().min(1),
  sourceUrl: z.url().nullable(),
  retrievedAt: z.iso.date(),
});

export const PatchSnapshotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  releasedAt: z.iso.date(),
  sourceIds: z.array(z.string().min(1)).min(1),
  verificationState: VerificationStateSchema,
  confidence: z.number().min(0).max(1),
  illustrative: z.boolean(),
});

export const TalentSchema = EvidenceFieldsSchema.extend({
  id: z.string().min(1),
  slug: SlugSchema,
  name: z.string().min(1),
  branch: z.string().min(1),
  generation: z.string().min(1),
});

export const SkillEffectSchema = EvidenceFieldsSchema.extend({
  id: z.string().min(1),
  slug: SlugSchema,
  name: z.string().min(1),
  category: z.enum(["score", "combo", "type-boost", "team-boost", "recovery"]),
  trigger: z.enum(["always", "note-window", "combo-threshold", "same-type-count", "chart-section"]),
  target: z.enum(["self", "team", "same-type"]),
  activationProbability: z.number().min(0).max(1),
  durationSeconds: z.number().nonnegative(),
  timingWindow: z.string().min(1),
  effectValue: z.number(),
});

export const ProgressionPointSchema = z.object({
  stage: z.number().int().min(1),
  investment: z.number().min(0).max(1),
  power: z.number().positive(),
});

export const MemberCardSchema = EvidenceFieldsSchema.extend({
  id: z.string().min(1),
  slug: SlugSchema,
  title: z.string().min(1),
  talentId: z.string().min(1),
  rarity: z.union([z.literal(4), z.literal(5)]),
  type: z.enum(["vocal", "dance", "smile"]),
  generation: z.string().min(1),
  patchId: z.string().min(1),
  skillIds: z.array(z.string().min(1)).min(1),
  synergyTags: z.array(z.string().min(1)),
  progression: z.array(ProgressionPointSchema).min(2),
  artAssetId: z.string().min(1).nullable(),
}).superRefine((card, context) => {
  for (let index = 1; index < card.progression.length; index += 1) {
    const current = card.progression[index];
    const previous = card.progression[index - 1];
    if (!current || !previous) continue;
    if (current.stage <= previous.stage || current.investment <= previous.investment || current.power <= previous.power) {
      context.addIssue({
        code: "custom",
        path: ["progression", index],
        message: "Progression must strictly increase by stage, investment, and power",
      });
    }
  }
});

export const LeaderOutfitSchema = EvidenceFieldsSchema.extend({
  id: z.string().min(1),
  slug: SlugSchema,
  title: z.string().min(1),
  talentId: z.string().min(1),
  outfitName: z.string().min(1),
  patchId: z.string().min(1),
  preferredTypes: z.array(z.enum(["vocal", "dance", "smile"])).min(1),
  synergyTags: z.array(z.string().min(1)),
  teamPowerMultiplier: z.number().positive(),
  artAssetId: z.string().min(1).nullable(),
});

export const GuideFormationSchema = z
  .object({
    label: z.enum(["premium", "standard", "accessible"]),
    cardIds: z.array(z.string().min(1)).length(5),
    projectedScore: z.number().positive(),
    replacementLoss: z.number().nonnegative(),
    notes: z.string().min(1),
  })
  .superRefine((formation, context) => {
    if (new Set(formation.cardIds).size !== formation.cardIds.length) {
      context.addIssue({
        code: "custom",
        path: ["cardIds"],
        message: "Formation Member slots must be unique",
      });
    }
  });

export const TeamGuideSchema = EvidenceFieldsSchema.extend({
  id: z.string().min(1),
  slug: SlugSchema,
  title: z.string().min(1),
  anchorCardId: z.string().min(1),
  leaderOutfitId: z.string().min(1),
  patchId: z.string().min(1),
  evidenceGrade: z.enum(["verified", "corroborated", "research-only"]),
  assumptions: z.array(z.string().min(1)).min(1),
  skillTiming: z.string().min(1),
  chartFit: z.array(z.string().min(1)).min(1),
  investmentOrder: z.array(z.string().min(1)).min(1),
  formations: z.array(GuideFormationSchema).min(1),
  changelog: z.array(z.object({ date: z.iso.date(), note: z.string().min(1) })).min(1),
});

export const RankingEntrySchema = z.object({
  cardId: z.string().min(1),
  rank: z.number().int().positive(),
  tier: z.enum(["SS", "S", "A", "B", "C", "D", "Provisional"]),
  performanceIndex: z.number(),
  interval: z.tuple([z.number(), z.number()]),
  metrics: z.object({
    G: z.number(),
    P: z.number(),
    B: z.number(),
    E: z.number(),
    C: z.number(),
  }),
  samplingError: z.number().nonnegative(),
  reasons: z.array(z.string()),
});

export const RankingSnapshotSchema = z.object({
  id: z.string().min(1),
  patchId: z.string().min(1),
  methodologyVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  lens: z.enum(["standard-manual", "low-investment", "max-ceiling", "expected-manual", "auto-live"]),
  seed: z.number().int().nonnegative(),
  chartCorpus: z.object({
    frozenSeasonalWeight: z.number().min(0).max(1),
    currentContentWeight: z.number().min(0).max(1),
    contexts: z.array(z.string()).min(1),
  }),
  assumptions: z.array(z.string().min(1)).min(1),
  baseline: z.object({
    G: z.object({ median: z.number(), mad: z.number().positive() }),
    P: z.object({ median: z.number(), mad: z.number().positive() }),
    B: z.object({ median: z.number(), mad: z.number().positive() }),
    E: z.object({ median: z.number(), mad: z.number().positive() }),
    C: z.object({ median: z.number(), mad: z.number().positive() }),
  }),
  entries: z.array(RankingEntrySchema),
  theorycraftBeta: z.boolean(),
});

export const ReviewQueueRecordSchema = z
  .object({
    id: z.string().min(1),
    entityId: z.string().min(1),
    field: z.string().min(1),
    status: z.enum(["open", "resolved", "rejected"]),
    claims: z
      .array(
        z.object({
          value: z.union([z.string(), z.number()]),
          sourceId: z.string().min(1),
        }),
      )
      .min(1),
    resolution: z
      .object({
        value: z.union([z.string(), z.number()]),
        sourceId: z.string().min(1),
        rationale: z.string().min(1),
        resolvedAt: z.iso.date(),
      })
      .nullable(),
    notes: z.string().min(1),
  })
  .superRefine((record, context) => {
    if (record.status === "resolved" && record.resolution === null) {
      context.addIssue({
        code: "custom",
        path: ["resolution"],
        message: "Resolved reviews require a source-linked resolution",
      });
    }
    if (record.status === "open" && record.resolution !== null) {
      context.addIssue({
        code: "custom",
        path: ["resolution"],
        message: "Open reviews cannot carry a silent resolution",
      });
    }
  });

const NullableCountSchema = z.number().int().nonnegative().nullable();
export const DatasetManifestSchema = z
  .object({
    id: z.string().min(1),
    patchId: z.string().min(1),
    scope: z.string().min(1),
    expectedCounts: z.object({
      fourStar: NullableCountSchema,
      fiveStar: NullableCountSchema,
      total: NullableCountSchema,
    }),
    observedCounts: z.object({
      fourStar: z.number().int().nonnegative(),
      fiveStar: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    sourceIds: z.array(z.string().min(1)).min(1),
    retrievedAt: z.iso.date(),
    verificationState: VerificationStateSchema,
    complete: z.boolean(),
    notes: z.string().min(1),
  })
  .superRefine((manifest, context) => {
    if (manifest.observedCounts.fourStar + manifest.observedCounts.fiveStar !== manifest.observedCounts.total) {
      context.addIssue({ code: "custom", path: ["observedCounts", "total"], message: "Observed rarity counts must sum to total" });
    }
    if (manifest.complete) {
      const expected = manifest.expectedCounts;
      if (expected.fourStar === null || expected.fiveStar === null || expected.total === null) {
        context.addIssue({ code: "custom", path: ["expectedCounts"], message: "Complete datasets require permitted expected counts" });
      } else if (
        expected.fourStar !== manifest.observedCounts.fourStar ||
        expected.fiveStar !== manifest.observedCounts.fiveStar ||
        expected.total !== manifest.observedCounts.total
      ) {
        context.addIssue({ code: "custom", path: ["observedCounts"], message: "Complete dataset counts must match expected counts" });
      }
    }
  });

export const DataBundleSchema = z.object({
  sources: z.array(SourceRecordSchema),
  assets: z.array(AssetRecordSchema),
  patches: z.array(PatchSnapshotSchema),
  talents: z.array(TalentSchema),
  skills: z.array(SkillEffectSchema),
  cards: z.array(MemberCardSchema),
  leaders: z.array(LeaderOutfitSchema),
  guides: z.array(TeamGuideSchema),
  reviews: z.array(ReviewQueueRecordSchema).default([]),
  datasetManifest: DatasetManifestSchema.optional(),
});

export type SourceRecord = z.infer<typeof SourceRecordSchema>;
export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type PatchSnapshot = z.infer<typeof PatchSnapshotSchema>;
export type Talent = z.infer<typeof TalentSchema>;
export type SkillEffect = z.infer<typeof SkillEffectSchema>;
export type MemberCard = z.infer<typeof MemberCardSchema>;
export type LeaderOutfit = z.infer<typeof LeaderOutfitSchema>;
export type TeamGuide = z.infer<typeof TeamGuideSchema>;
export type RankingEntry = z.infer<typeof RankingEntrySchema>;
export type RankingSnapshot = z.infer<typeof RankingSnapshotSchema>;
export type ReviewQueueRecord = z.infer<typeof ReviewQueueRecordSchema>;
export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type DataBundle = z.infer<typeof DataBundleSchema>;
