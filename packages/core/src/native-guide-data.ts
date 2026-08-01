import nativeGuideJson from "../../../data/generated/native-guides.json";

import {
  NativeGuideDataSchema,
  type NativeGuideData,
} from "./native-guide-schema";

export const nativeGuideData: NativeGuideData =
  NativeGuideDataSchema.parse(nativeGuideJson);

export const nativeGuideBySlug = new Map(
  nativeGuideData.guides.map((guide) => [guide.slug, guide]),
);

export const nativeGuideByAnchorCardId = new Map(
  nativeGuideData.guides.map((guide) => [guide.anchorCardId, guide]),
);
