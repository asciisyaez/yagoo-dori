import publicDataJson from "../../../data/generated/holodori-public.json";
import { z } from "zod";

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
  editorialTier: z.enum(["SS", "S", "A"]).nullable(),
});

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
    editorialTier: z.object({
      page: z.url(),
      label: z.string().min(1),
      updatedAt: z.iso.datetime({ offset: true }),
    }),
  }),
  counts: z.object({
    talents: z.literal(54),
    fourStar: z.literal(54),
    fiveStar: z.literal(59),
    total: z.literal(113),
    art: z.literal(113),
  }),
  notes: z.array(z.string().min(1)),
  cards: z.array(PublicCardSchema).length(113),
}).superRefine((data, context) => {
  const ids = new Set(data.cards.map((card) => card.id));
  const slugs = new Set(data.cards.map((card) => card.slug));
  const talents = new Set(data.cards.map((card) => card.talentId));
  const fourStar = data.cards.filter((card) => card.rarity === 4);
  const fiveStar = data.cards.filter((card) => card.rarity === 5);
  const tierCounts = Object.fromEntries(
    ["SS", "S", "A"].map((tier) => [
      tier,
      fiveStar.filter((card) => card.editorialTier === tier).length,
    ]),
  );

  if (ids.size !== data.cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Card IDs must be unique" });
  }
  if (slugs.size !== data.cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Card slugs must be unique" });
  }
  if (talents.size !== 54 || fourStar.length !== 54 || fiveStar.length !== 59) {
    context.addIssue({ code: "custom", path: ["counts"], message: "Roster counts do not match the pinned snapshot" });
  }
  if (fourStar.some((card) => card.editorialTier !== null)) {
    context.addIssue({ code: "custom", path: ["cards"], message: "The AppMedia score-tier snapshot covers 5-star cards only" });
  }
  if (tierCounts.SS !== 10 || tierCounts.S !== 23 || tierCounts.A !== 26) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Editorial tier counts do not match the 2026-07-30 AppMedia snapshot" });
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

export const publicCardById = new Map(publicCards.map((card) => [card.id, card]));
export const publicCardBySlug = new Map(publicCards.map((card) => [card.slug, card]));

export const publicTalents = [...new Map(
  publicCards.map((card) => [
    card.talentId,
    {
      id: card.talentId,
      name: card.talentName,
      generation: card.generation,
      groups: card.groups,
      branch: card.branch,
      color: card.color,
      cards: publicCards.filter((candidate) => candidate.talentId === card.talentId),
    },
  ]),
).values()].sort((left, right) => left.name.localeCompare(right.name));
