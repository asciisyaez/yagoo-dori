import { z } from "zod";

import currentBannerJson from "../../../data/native/current-banner-v1.json";

const CurrentBannerSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.literal("summer-survival-on-the-island-2026-08-29"),
  status: z.literal("live"),
  retrievedAt: z.iso.date(),
  eventName: z.literal("Summer Survival on the Island!"),
  gachaNameJa: z.literal("炎天下のトロピックアイランドガチャ"),
  startsAt: z.iso.datetime({ offset: true }),
  featuredCardIds: z.array(z.string().min(1)).length(4),
  eventSongIds: z.array(z.string().min(1)).length(5),
  sourceRefs: z.array(z.string().min(1)).min(1),
  transformation: z.string().min(1),
}).strict();

export type CurrentBanner = z.infer<typeof CurrentBannerSchema>;

export const currentBanner: CurrentBanner = CurrentBannerSchema.parse(currentBannerJson);
