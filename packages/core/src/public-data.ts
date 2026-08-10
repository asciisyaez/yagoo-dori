import publicDataJson from "../../../data/generated/holodori-public.json";
import { z } from "zod";
import { comparePublicMemberCards } from "./member-card-order";
export { comparePublicMemberCards } from "./member-card-order";

export const PublicSkillLevelSchema = z.object({
  level: z.number().int().positive(),
  description: z.string().min(1).nullable(),
  effectGroupId: z.string().min(1).nullable(),
  triggerGroupId: z.string().min(1).nullable(),
  additionalEffectGroupId: z.string().min(1).nullable(),
  additionalTriggerGroupId: z.string().min(1).nullable(),
  cooldownSeconds: z.number().nonnegative().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  activationProbability: z.number().min(0).max(1).nullable(),
});

const ParameterSetSchema = z.object({
  performance: z.number().int().positive(),
  technique: z.number().int().positive(),
  sense: z.number().int().positive(),
});

export const PublicCardSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  talentId: z.string().min(1),
  generationOrder: z.number().int().positive(),
  talentName: z.string().min(1),
  title: z.string().min(1),
  titleJa: z.string().min(1),
  rarity: z.union([z.literal(4), z.literal(5)]),
  attribute: z.enum(["cute", "pure", "happy"]),
  generation: z.string().min(1),
  groups: z.array(z.string().min(1)).min(1),
  branch: z.enum(["hololive Japan", "hololive English", "hololive Indonesia"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  assetId: z.string().min(1),
  artPath: z.string().startsWith("/game/cards/"),
  illustrationPath: z.string().startsWith("/game/illustrations/"),
  maxLevel: z.number().int().positive(),
  parameterDistribution: z.object({
    performance: z.number().min(0).max(1),
    technique: z.number().min(0).max(1),
    sense: z.number().min(0).max(1),
  }),
  parameters: z.object({
    oneCopyMaxLevel: ParameterSetSchema,
    maxPotential: ParameterSetSchema,
  }),
  skills: z.object({
    active: z.array(PublicSkillLevelSchema).min(1),
    passive: z.array(PublicSkillLevelSchema).min(1),
    special: z.array(PublicSkillLevelSchema).min(1),
  }),
  leaderOutfit: z.object({
    costumeId: z.string().min(1),
    costumeName: z.string().min(1),
    description: z.string().min(1).nullable(),
    effectGroupId: z.string().min(1).nullable(),
    triggerGroupId: z.string().min(1).nullable(),
    additionalEffectGroupId: z.string().min(1).nullable(),
    additionalTriggerGroupId: z.string().min(1).nullable(),
  }),
}).strict();

export const PublicDataSchema = z.object({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.date(),
  sourceSnapshots: z.object({
    english: z.object({
      repository: z.url(),
      commit: z.string().regex(/^[0-9a-f]{40}$/),
      masterVersion: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    japanese: z.object({
      repository: z.url(),
      commit: z.string().regex(/^[0-9a-f]{40}$/),
      masterVersion: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    art: z.object({ page: z.url(), label: z.string().min(1) }),
  }).strict(),
  counts: z.object({
    talents: z.number().int().positive(),
    fourStar: z.number().int().nonnegative(),
    fiveStar: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    art: z.number().int().nonnegative(),
  }),
  notes: z.array(z.string().min(1)),
  cards: z.array(PublicCardSchema).min(1),
}).superRefine((data, context) => {
  const ids = new Set(data.cards.map((card) => card.id));
  const slugs = new Set(data.cards.map((card) => card.slug));
  const talents = new Set(data.cards.map((card) => card.talentId));
  const fourStar = data.cards.filter((card) => card.rarity === 4);
  const fiveStar = data.cards.filter((card) => card.rarity === 5);

  if (ids.size !== data.cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Card IDs must be unique" });
  }
  if (slugs.size !== data.cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Card slugs must be unique" });
  }
  const actualCounts = {
    talents: talents.size,
    fourStar: fourStar.length,
    fiveStar: fiveStar.length,
    total: data.cards.length,
    art: data.cards.filter((card) => card.artPath && card.illustrationPath).length,
  };
  for (const [key, actual] of Object.entries(actualCounts)) {
    if (data.counts[key as keyof typeof data.counts] !== actual) {
      context.addIssue({
        code: "custom",
        path: ["counts", key],
        message: `Declared ${key} count does not match the normalized roster`,
      });
    }
  }
  for (const [index, card] of data.cards.entries()) {
    const totalDistribution =
      card.parameterDistribution.performance +
      card.parameterDistribution.technique +
      card.parameterDistribution.sense;
    if (Math.abs(totalDistribution - 1) > 0.000_001) {
      context.addIssue({
        code: "custom",
        path: ["cards", index, "parameterDistribution"],
        message: "Parameter distribution must sum to 1",
      });
    }
  }
});

export type PublicCard = z.infer<typeof PublicCardSchema>;
export type PublicData = z.infer<typeof PublicDataSchema>;

export const publicData: PublicData = PublicDataSchema.parse(publicDataJson);
export const publicCards = publicData.cards;
export const publicCardsInGenerationOrder = [...publicCards].sort(comparePublicMemberCards);

export const publicCardById = new Map(publicCards.map((card) => [card.id, card]));
export const publicCardBySlug = new Map(publicCards.map((card) => [card.slug, card]));

export const publicTalents = [...new Map(
  publicCards.map((card) => [
    card.talentId,
    {
      id: card.talentId,
      name: card.talentName,
      generationOrder: card.generationOrder,
      generation: card.generation,
      groups: card.groups,
      branch: card.branch,
      color: card.color,
      cards: publicCardsInGenerationOrder.filter((candidate) => candidate.talentId === card.talentId),
    },
  ]),
).values()].sort((left, right) =>
  left.generationOrder - right.generationOrder || left.id.localeCompare(right.id),
);
