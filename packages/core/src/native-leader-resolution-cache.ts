import {
  assertLegalFormation,
  resolveLeaderApplications,
  type BloomStage,
  type FormationMember,
  type InvestmentLayer,
} from "./formation-evaluator";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import { mechanicsData } from "./mechanics";
import { songContextData } from "./song-contexts";

export const NATIVE_LEADER_RESOLUTION_CACHE_VERSION =
  "yd-native-leader-resolution-cache-1.0.0" as const;

export type NativeLeaderResolutionGroup = Readonly<{
  /** Full canonical resolved application graph used as the equality key. */
  signature: string;
  representativeCardId: string;
  eligibleCardIds: readonly string[];
  structuralClassSignature: string;
}>;

export type NativeLeaderResolutionCacheInput = Readonly<{
  memberCardIds: readonly string[];
  leaderOutfitCardIds: readonly string[];
  chartKey: string;
  investmentLayer: InvestmentLayer;
  bloomStageByCardId?: Readonly<Record<string, BloomStage>>;
}>;

export type NativeLeaderResolutionCacheResult = Readonly<{
  kind: "native-leader-resolution-groups";
  methodologyVersion: typeof NATIVE_LEADER_RESOLUTION_CACHE_VERSION;
  chartKey: string;
  groups: readonly NativeLeaderResolutionGroup[];
  counts: Readonly<{
    eligibleLeaderOutfits: number;
    structuralClasses: number;
    resolvedGroups: number;
    collapsedLeaderOutfits: number;
  }>;
}>;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function uniqueSorted(ids: readonly string[], label: string): string[] {
  const sorted = [...ids].sort((left, right) => left.localeCompare(right));
  if (new Set(sorted).size !== sorted.length) throw new Error(`${label} must be unique`);
  return sorted;
}

function memberInputs(input: NativeLeaderResolutionCacheInput): FormationMember[] {
  return input.memberCardIds.map((cardId) => {
    const bloomStage = input.bloomStageByCardId?.[cardId];
    return bloomStage === undefined
      ? { cardId, investment: input.investmentLayer }
      : { cardId, investment: input.investmentLayer, bloomStage };
  });
}

/**
 * Group eligible Leaders only when their pinned structural equivalence class
 * and chart-specific resolved application graph are both identical. The full
 * graph is retained as the map key; no lossy hash or score approximation is
 * used. This is a safe evaluator-call reduction candidate, not a certificate.
 */
export function groupNativeLeadersByResolvedApplications(
  input: NativeLeaderResolutionCacheInput,
): NativeLeaderResolutionCacheResult {
  const memberCardIds = uniqueSorted(input.memberCardIds, "Member IDs");
  const leaderOutfitCardIds = uniqueSorted(input.leaderOutfitCardIds, "Leader/Outfit IDs");
  if (memberCardIds.length !== 5) throw new Error("Leader-resolution grouping requires five Members");
  if (leaderOutfitCardIds.length === 0) throw new Error("Leader-resolution grouping needs a Leader");
  if (!songContextData.charts.some((chart) => chart.key === input.chartKey)) {
    throw new Error(`Unknown chart key: ${input.chartKey}`);
  }
  for (const cardId of memberCardIds) {
    if (!mechanicsData.cards.some((card) => card.cardId === cardId)) {
      throw new Error(`Unknown Member card: ${cardId}`);
    }
  }

  const chart = songContextData.charts.find((candidate) => candidate.key === input.chartKey)!;
  const song = songContextData.songs.find((candidate) => candidate.id === chart.songId);
  if (!song) throw new Error(`Chart ${chart.key} has no song context`);
  const members = memberInputs({ ...input, memberCardIds });
  const structural = compileNativeLeaderEquivalence({
    eligibleLeaderOutfitCardIds: leaderOutfitCardIds,
  });
  const groups: NativeLeaderResolutionGroup[] = [];

  for (const structuralClass of structural.classes) {
    const byResolution = new Map<string, string[]>();
    for (const leaderOutfitCardId of structuralClass.eligibleCardIds) {
      const legal = assertLegalFormation({ leaderOutfitCardId, members });
      const resolution = resolveLeaderApplications(
        legal.leaderOutfit.mechanics.leaderOutfit.applications,
        legal,
        {
          combo: chart.fullComboNoteCount,
          life: 1_000,
          judgement: "perfect",
          songSingerTalentIds: song.singerTalentIds,
        },
      );
      const signature = canonicalize({
        structuralClass: structuralClass.signature,
        status: resolution.status,
        alternatives: resolution.alternatives,
      });
      const ids = byResolution.get(signature) ?? [];
      ids.push(leaderOutfitCardId);
      byResolution.set(signature, ids);
    }
    for (const [signature, ids] of byResolution.entries()) {
      const eligibleCardIds = [...ids].sort((left, right) => left.localeCompare(right));
      groups.push({
        signature,
        representativeCardId: eligibleCardIds[0]!,
        eligibleCardIds,
        structuralClassSignature: structuralClass.signature,
      });
    }
  }

  groups.sort((left, right) => left.representativeCardId.localeCompare(right.representativeCardId));
  return {
    kind: "native-leader-resolution-groups",
    methodologyVersion: NATIVE_LEADER_RESOLUTION_CACHE_VERSION,
    chartKey: input.chartKey,
    groups,
    counts: {
      eligibleLeaderOutfits: leaderOutfitCardIds.length,
      structuralClasses: structural.classes.length,
      resolvedGroups: groups.length,
      collapsedLeaderOutfits: leaderOutfitCardIds.length - groups.length,
    },
  };
}
