import nativeRankingJson from "../../../data/generated/native-rankings.json";

import {
  NativeRankingSnapshotSchema,
  type NativeLens,
  type NativeRankingEntry,
  type NativeRankingSnapshot,
} from "./native-ranking-schema";

export const nativeRankingData: NativeRankingSnapshot =
  NativeRankingSnapshotSchema.parse(nativeRankingJson);

export const nativeMemberRankingLensById = new Map(
  nativeRankingData.lenses.map((lens) => [lens.investment, lens]),
);

export const nativeLeaderOutfitRankingLensById = new Map(
  nativeRankingData.leaderOutfitLenses.map((lens) => [lens.investment, lens]),
);

/** @deprecated Use nativeMemberRankingLensById when the ranking context matters. */
export const nativeRankingLensById = nativeMemberRankingLensById;

export const nativeRankingEntryByLensAndCard = new Map<
  NativeLens,
  ReadonlyMap<string, NativeRankingEntry>
>(
  nativeRankingData.lenses.map((lens) => [
    lens.investment,
    new Map(lens.entries.map((entry) => [entry.cardId, entry])),
  ]),
);

export const nativeLeaderOutfitRankingEntryByLensAndCard = new Map<
  NativeLens,
  ReadonlyMap<string, NativeRankingEntry>
>(
  nativeRankingData.leaderOutfitLenses.map((lens) => [
    lens.investment,
    new Map(lens.entries.map((entry) => [entry.cardId, entry])),
  ]),
);
