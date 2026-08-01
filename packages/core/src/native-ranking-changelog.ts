import { z } from "zod";

import {
  attributeNativeIndexDelta,
  type NativeDeltaReason,
} from "./native-metrics";
import {
  NativeLensSchema,
  NativeModelBandSchema,
  NativeRankingEntityKindSchema,
  NativeStableTierSchema,
  type NativeLens,
  type NativeRankingEntityKind,
  type NativeRankingSnapshot,
  type NativeStableTier,
} from "./native-ranking-schema";

const INDEX_MICRO_SCALE = 1_000_000;
const TIER_ORDER = ["D", "C", "B", "A", "S", "SS"] as const;

const NativeDeltaReasonSchema = z.enum([
  "direct-change",
  "new-synergy",
  "chart-meta",
  "new-evidence",
  "methodology-correction",
]);

const ComparableEntrySchema = z.object({
  cardId: z.string().min(1),
  rank: z.number().int().positive(),
  tier: NativeModelBandSchema,
  stableTier: NativeStableTierSchema,
  index: z.object({ central: z.number().finite() }),
});

const ComparableLensSchema = z.object({
  entityKind: NativeRankingEntityKindSchema,
  investment: NativeLensSchema,
  entries: z.array(ComparableEntrySchema),
});

export const NativeComparableRankingSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  generatedAt: z.iso.datetime({ offset: true }),
  methodologyVersion: z.string().min(1),
  lenses: z.array(ComparableLensSchema),
  leaderOutfitLenses: z.array(ComparableLensSchema),
});

export type NativeComparableRankingSnapshot = z.infer<
  typeof NativeComparableRankingSnapshotSchema
>;

const SerializedDeltaPartSchema = z
  .object({
    reason: NativeDeltaReasonSchema,
    deltaMicro: z.number().int().safe(),
    delta: z.number().finite(),
  })
  .strict()
  .superRefine((part, context) => {
    if (Math.abs(part.delta - part.deltaMicro / INDEX_MICRO_SCALE) > 0.000_000_1) {
      context.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Displayed attribution delta must match its exact micro-index value",
      });
    }
  });

const TierDeltaSchema = z
  .object({
    from: NativeModelBandSchema.nullable(),
    to: NativeModelBandSchema.nullable(),
    steps: z.number().int().nullable(),
  })
  .strict();

const StableTierDeltaSchema = z
  .object({
    from: NativeStableTierSchema.nullable(),
    to: NativeStableTierSchema.nullable(),
  })
  .strict();

export const NativeRankingChangeSchema = z
  .object({
    entityKind: NativeRankingEntityKindSchema,
    investment: NativeLensSchema,
    cardId: z.string().min(1),
    status: z.enum(["added", "removed", "updated"]),
    scoreDeltaMicro: z.number().int().safe().nullable(),
    scoreDelta: z.number().finite().nullable(),
    rankDelta: z.number().int().nullable(),
    tierDelta: TierDeltaSchema,
    stableTierDelta: StableTierDeltaSchema,
    attribution: z.array(SerializedDeltaPartSchema),
  })
  .strict()
  .superRefine((change, context) => {
    if ((change.scoreDeltaMicro === null) !== (change.scoreDelta === null)) {
      context.addIssue({
        code: "custom",
        path: ["scoreDelta"],
        message: "Exact and displayed score deltas must both be present or absent",
      });
      return;
    }
    if (change.scoreDeltaMicro === null) {
      if (change.rankDelta !== null || change.status === "updated") {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "Added and removed rows cannot carry update-only deltas",
        });
      }
      return;
    }
    if (Math.abs(change.scoreDelta! - change.scoreDeltaMicro / INDEX_MICRO_SCALE) > 0.000_000_1) {
      context.addIssue({
        code: "custom",
        path: ["scoreDelta"],
        message: "Displayed score delta must match its exact micro-index value",
      });
    }
    const attributed = change.attribution.reduce((sum, part) => sum + part.deltaMicro, 0);
    if (attributed !== change.scoreDeltaMicro) {
      context.addIssue({
        code: "custom",
        path: ["attribution"],
        message: "Attribution parts must sum exactly to the score delta",
      });
    }
  });

const SnapshotReferenceSchema = z
  .object({
    snapshotId: z.string().min(1),
    generatedAt: z.iso.datetime({ offset: true }),
    methodologyVersion: z.string().min(1),
  })
  .strict();

export const NativeRankingChangelogSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    from: SnapshotReferenceSchema.nullable(),
    to: SnapshotReferenceSchema,
    attributionPolicy: z.literal("exact-micro-index-sum-required"),
    rankDeltaConvention: z.literal("positive-means-rank-improved"),
    entries: z.array(NativeRankingChangeSchema),
    summary: z
      .object({
        added: z.number().int().nonnegative(),
        removed: z.number().int().nonnegative(),
        scoreChanged: z.number().int().nonnegative(),
        rankChanged: z.number().int().nonnegative(),
        tierChanged: z.number().int().nonnegative(),
        stableTierChanged: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((changelog, context) => {
    const keys = changelog.entries.map(changeKey);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: "custom", path: ["entries"], message: "Change keys must be unique" });
    }
    const expected = summarizeChanges(changelog.entries);
    if (JSON.stringify(expected) !== JSON.stringify(changelog.summary)) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Changelog summary must match its entries",
      });
    }
  });

export type NativeRankingChange = z.infer<typeof NativeRankingChangeSchema>;
export type NativeRankingChangelog = z.infer<typeof NativeRankingChangelogSchema>;

export const NativeRankingAttributionManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    fromSnapshotId: z.string().min(1),
    fromGeneratedAt: z.iso.datetime({ offset: true }),
    toSnapshotId: z.string().min(1),
    toGeneratedAt: z.iso.datetime({ offset: true }),
    entries: z.array(
      z
        .object({
          entityKind: NativeRankingEntityKindSchema,
          investment: NativeLensSchema,
          cardId: z.string().min(1),
          parts: z.array(
            z
              .object({
                reason: NativeDeltaReasonSchema,
                deltaMicro: z.number().int().safe(),
              })
              .strict(),
          ).min(1),
        })
        .strict(),
    ),
  })
  .strict();

export type NativeRankingAttributionManifest = z.infer<
  typeof NativeRankingAttributionManifestSchema
>;

type ComparableEntry = z.infer<typeof ComparableEntrySchema>;
type IndexedEntry = Readonly<{
  entityKind: NativeRankingEntityKind;
  investment: NativeLens;
  entry: ComparableEntry;
}>;

function changeKey(change: Pick<NativeRankingChange, "entityKind" | "investment" | "cardId">): string {
  return `${change.entityKind}|${change.investment}|${change.cardId}`;
}

function snapshotReference(snapshot: NativeComparableRankingSnapshot) {
  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    methodologyVersion: snapshot.methodologyVersion,
  };
}

function indexSnapshot(snapshot: NativeComparableRankingSnapshot): Map<string, IndexedEntry> {
  const result = new Map<string, IndexedEntry>();
  for (const lens of [...snapshot.lenses, ...snapshot.leaderOutfitLenses]) {
    for (const entry of lens.entries) {
      const indexed = { entityKind: lens.entityKind, investment: lens.investment, entry };
      const key = changeKey({ ...indexed, cardId: entry.cardId });
      if (result.has(key)) throw new Error(`Duplicate comparable ranking entry: ${key}`);
      result.set(key, indexed);
    }
  }
  return result;
}

function tierSteps(from: string | null, to: string | null): number | null {
  if (from === null || to === null) return null;
  return TIER_ORDER.indexOf(to as typeof TIER_ORDER[number]) -
    TIER_ORDER.indexOf(from as typeof TIER_ORDER[number]);
}

function serializeParts(parts: readonly Readonly<{ reason: NativeDeltaReason; deltaMicro: bigint }>[]) {
  return parts.map((part) => ({
    reason: part.reason,
    deltaMicro: Number(part.deltaMicro),
    delta: Number(part.deltaMicro) / INDEX_MICRO_SCALE,
  }));
}

function summarizeChanges(entries: readonly NativeRankingChange[]) {
  return {
    added: entries.filter((entry) => entry.status === "added").length,
    removed: entries.filter((entry) => entry.status === "removed").length,
    scoreChanged: entries.filter((entry) => entry.scoreDeltaMicro !== null && entry.scoreDeltaMicro !== 0).length,
    rankChanged: entries.filter((entry) => entry.rankDelta !== null && entry.rankDelta !== 0).length,
    tierChanged: entries.filter((entry) => entry.tierDelta.from !== entry.tierDelta.to).length,
    stableTierChanged: entries.filter(
      (entry) => entry.stableTierDelta.from !== entry.stableTierDelta.to,
    ).length,
  };
}

function validateManifest(
  manifest: NativeRankingAttributionManifest | undefined,
  previous: NativeComparableRankingSnapshot | null,
  current: NativeComparableRankingSnapshot,
): Map<string, NativeRankingAttributionManifest["entries"][number]> {
  if (!manifest) return new Map();
  if (!previous) throw new Error("An attribution manifest requires a previous snapshot");
  if (
    manifest.fromSnapshotId !== previous.snapshotId ||
    manifest.fromGeneratedAt !== previous.generatedAt ||
    manifest.toSnapshotId !== current.snapshotId ||
    manifest.toGeneratedAt !== current.generatedAt
  ) {
    throw new Error("Attribution manifest snapshot references do not match the transition");
  }
  const result = new Map<string, NativeRankingAttributionManifest["entries"][number]>();
  for (const entry of manifest.entries) {
    const key = changeKey(entry);
    if (result.has(key)) throw new Error(`Duplicate attribution manifest entry: ${key}`);
    result.set(key, entry);
  }
  return result;
}

export function generateNativeRankingChangelog(
  previousInput: NativeComparableRankingSnapshot | null,
  currentInput: NativeRankingSnapshot,
  manifestInput?: NativeRankingAttributionManifest,
): NativeRankingChangelog {
  const previous = previousInput
    ? NativeComparableRankingSnapshotSchema.parse(previousInput)
    : null;
  const current = NativeComparableRankingSnapshotSchema.parse(currentInput);
  const manifest = manifestInput
    ? NativeRankingAttributionManifestSchema.parse(manifestInput)
    : undefined;
  const manifestByKey = validateManifest(manifest, previous, current);
  const previousByKey = previous ? indexSnapshot(previous) : new Map<string, IndexedEntry>();
  const currentByKey = indexSnapshot(current);
  const rosterChanged = previous !== null &&
    [...previousByKey.keys()].sort().join("\0") !== [...currentByKey.keys()].sort().join("\0");
  const changes: NativeRankingChange[] = [];

  for (const key of new Set([...previousByKey.keys(), ...currentByKey.keys()])) {
    const before = previousByKey.get(key);
    const after = currentByKey.get(key);
    const indexed = after ?? before!;
    const manifestEntry = manifestByKey.get(key);

    if (!before || !after) {
      if (manifestEntry) {
        throw new Error(`Attribution manifests cannot assign an undefined score delta: ${key}`);
      }
      changes.push({
        entityKind: indexed.entityKind,
        investment: indexed.investment,
        cardId: indexed.entry.cardId,
        status: after ? "added" : "removed",
        scoreDeltaMicro: null,
        scoreDelta: null,
        rankDelta: null,
        tierDelta: {
          from: before?.entry.tier ?? null,
          to: after?.entry.tier ?? null,
          steps: tierSteps(before?.entry.tier ?? null, after?.entry.tier ?? null),
        },
        stableTierDelta: {
          from: before?.entry.stableTier ?? null,
          to: after?.entry.stableTier ?? null,
        },
        attribution: serializeParts([
          { reason: after ? "new-evidence" : "direct-change", deltaMicro: 0n },
        ]),
      });
      continue;
    }

    const scoreDeltaMicro = Math.round(after.entry.index.central * INDEX_MICRO_SCALE) -
      Math.round(before.entry.index.central * INDEX_MICRO_SCALE);
    const rankDelta = before.entry.rank - after.entry.rank;
    const tierChanged = before.entry.tier !== after.entry.tier;
    const stableTierChanged = before.entry.stableTier !== after.entry.stableTier;
    if (scoreDeltaMicro === 0 && rankDelta === 0 && !tierChanged && !stableTierChanged) {
      if (manifestEntry) throw new Error(`Attribution supplied for an unchanged entry: ${key}`);
      continue;
    }

    let parts: readonly Readonly<{ reason: NativeDeltaReason; deltaMicro: bigint }>[];
    if (manifestEntry) {
      parts = manifestEntry.parts.map((part) => ({
        reason: part.reason,
        deltaMicro: BigInt(part.deltaMicro),
      }));
    } else if (scoreDeltaMicro !== 0) {
      throw new Error(`Missing exact score-delta attribution for ${key}`);
    } else if (previous!.methodologyVersion !== current.methodologyVersion) {
      parts = [{ reason: "methodology-correction", deltaMicro: 0n }];
    } else if (rosterChanged || before.entry.stableTier === "Provisional") {
      parts = [{ reason: "new-evidence", deltaMicro: 0n }];
    } else {
      throw new Error(`Missing attribution for a zero-score ranking transition: ${key}`);
    }
    const attributed = attributeNativeIndexDelta(BigInt(scoreDeltaMicro), parts);
    manifestByKey.delete(key);
    changes.push({
      entityKind: after.entityKind,
      investment: after.investment,
      cardId: after.entry.cardId,
      status: "updated",
      scoreDeltaMicro,
      scoreDelta: scoreDeltaMicro / INDEX_MICRO_SCALE,
      rankDelta,
      tierDelta: {
        from: before.entry.tier,
        to: after.entry.tier,
        steps: tierSteps(before.entry.tier, after.entry.tier),
      },
      stableTierDelta: {
        from: before.entry.stableTier,
        to: after.entry.stableTier,
      },
      attribution: serializeParts(attributed.parts),
    });
  }

  if (manifestByKey.size > 0) {
    throw new Error(`Attribution manifest contains unmatched entries: ${[...manifestByKey.keys()].join(", ")}`);
  }

  changes.sort(
    (left, right) =>
      left.entityKind.localeCompare(right.entityKind) ||
      left.investment.localeCompare(right.investment) ||
      Math.abs(right.scoreDeltaMicro ?? 0) - Math.abs(left.scoreDeltaMicro ?? 0) ||
      left.cardId.localeCompare(right.cardId),
  );
  return NativeRankingChangelogSchema.parse({
    schemaVersion: 1,
    id: `${previous?.snapshotId ?? "initial"}@${previous?.generatedAt ?? "none"}->${current.snapshotId}@${current.generatedAt}`,
    from: previous ? snapshotReference(previous) : null,
    to: snapshotReference(current),
    attributionPolicy: "exact-micro-index-sum-required",
    rankDeltaConvention: "positive-means-rank-improved",
    entries: changes,
    summary: summarizeChanges(changes),
  });
}

export function previousStableTierMap(
  snapshotInput: NativeComparableRankingSnapshot | null,
  methodologyVersion: string,
): ReadonlyMap<string, NativeStableTier> {
  if (!snapshotInput || snapshotInput.methodologyVersion !== methodologyVersion) return new Map();
  const snapshot = NativeComparableRankingSnapshotSchema.parse(snapshotInput);
  return new Map(
    [...indexSnapshot(snapshot)].map(([key, value]) => [key, value.entry.stableTier]),
  );
}

export function nativeRankingTransitionKey(
  entityKind: NativeRankingEntityKind,
  investment: NativeLens,
  cardId: string,
): string {
  return changeKey({ entityKind, investment, cardId });
}
