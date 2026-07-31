import assetsJson from "../../../data/assets.json";
import cardsJson from "../../../data/cards.json";
import datasetManifestJson from "../../../data/dataset-manifest.json";
import guidesJson from "../../../data/guides.json";
import leadersJson from "../../../data/leaders.json";
import patchesJson from "../../../data/patches.json";
import reviewsJson from "../../../data/review-queue.json";
import skillsJson from "../../../data/skills.json";
import sourcesJson from "../../../data/sources.json";
import talentsJson from "../../../data/talents.json";

import { DataBundleSchema, type DataBundle } from "./schemas";

export const researchBundle: DataBundle = DataBundleSchema.parse({
  sources: sourcesJson,
  assets: assetsJson,
  patches: patchesJson,
  talents: talentsJson,
  skills: skillsJson,
  cards: cardsJson,
  leaders: leadersJson,
  guides: guidesJson,
  reviews: reviewsJson,
  datasetManifest: datasetManifestJson,
});

export const dataIndex = {
  sources: new Map(researchBundle.sources.map((source) => [source.id, source])),
  assets: new Map(researchBundle.assets.map((asset) => [asset.id, asset])),
  patches: new Map(researchBundle.patches.map((patch) => [patch.id, patch])),
  talents: new Map(researchBundle.talents.map((talent) => [talent.id, talent])),
  skills: new Map(researchBundle.skills.map((skill) => [skill.id, skill])),
  cards: new Map(researchBundle.cards.map((card) => [card.id, card])),
  leaders: new Map(researchBundle.leaders.map((leader) => [leader.id, leader])),
  guides: new Map(researchBundle.guides.map((guide) => [guide.id, guide])),
} as const;

export function getTalentBySlug(slug: string) {
  return researchBundle.talents.find((talent) => talent.slug === slug);
}

export function getCardBySlug(slug: string) {
  return researchBundle.cards.find((card) => card.slug === slug);
}

export function getLeaderBySlug(slug: string) {
  return researchBundle.leaders.find((leader) => leader.slug === slug);
}

export function getSkillBySlug(slug: string) {
  return researchBundle.skills.find((skill) => skill.slug === slug);
}

export function getGuideBySlug(slug: string) {
  return researchBundle.guides.find((guide) => guide.slug === slug);
}
