import { z } from "zod";

import currentBannerJson from "../../../data/native/current-banner-v1.json";

const CurrentBannerSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  status: z.literal("live"),
  retrievedAt: z.iso.date(),
  eventName: z.string().min(1),
  gachaNameJa: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  featuredCardIds: z.array(z.string().min(1)).min(1),
  eventSongIds: z.array(z.string().min(1)).min(1),
  sourceRefs: z.array(z.string().min(1)).min(1),
  transformation: z.string().min(1),
}).strict();

export type CurrentBanner = z.infer<typeof CurrentBannerSchema>;

export const currentBanner: CurrentBanner = CurrentBannerSchema.parse(currentBannerJson);
