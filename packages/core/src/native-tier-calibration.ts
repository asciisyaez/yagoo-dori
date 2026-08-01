import calibrationJson from "../../../data/native/tier-calibration-v1.json";
import { z } from "zod";

import type { NativeLens, NativeModelBand } from "./native-ranking-schema";

const TierBoundariesSchema = z
  .object({
    SS: z.number().finite(),
    S: z.number().finite(),
    A: z.number().finite(),
    B: z.number().finite(),
    C: z.number().finite(),
  })
  .strict()
  .refine(
    ({ SS, S, A, B, C }) => SS > S && S > A && A > B && B > C,
    "Member tier boundaries must descend from SS through C",
  );

export const NativeMemberTierCalibrationSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    methodologyVersion: z.literal("yd-member-tier-calibration-1.0.0"),
    sourceSnapshotId: z.string().min(1),
    sourceSnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
    selection: z
      .object({
        fiveStarBands: z.string().min(1),
        rarityBoundary: z.string().min(1),
        fourStarBands: z.string().min(1),
        futureCards: z.string().min(1),
      })
      .strict(),
    lenses: z
      .object({
        "low-investment": TierBoundariesSchema,
        "one-copy-maximum": TierBoundariesSchema,
        "duplicate-enabled-ceiling": TierBoundariesSchema,
      })
      .strict(),
  })
  .strict();

export const nativeMemberTierCalibration = NativeMemberTierCalibrationSchema.parse(
  calibrationJson,
);

/**
 * Convert the continuous native Member index into a decision tier using
 * boundaries frozen from the pinned launch roster. New releases are measured
 * against the same cutoffs, so adding an unrelated card cannot move an old one.
 */
export function memberTierForIndex(lens: NativeLens, index: number): NativeModelBand {
  if (!Number.isFinite(index)) throw new Error("Member tier index must be finite");
  const boundaries = nativeMemberTierCalibration.lenses[lens];
  if (index >= boundaries.SS) return "SS";
  if (index >= boundaries.S) return "S";
  if (index >= boundaries.A) return "A";
  if (index >= boundaries.B) return "B";
  if (index >= boundaries.C) return "C";
  return "D";
}
