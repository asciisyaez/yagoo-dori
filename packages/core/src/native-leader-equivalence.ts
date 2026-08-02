import { mechanicsData, type CardMechanics } from "./mechanics";
import { publicCardById } from "./public-data";

const METHODOLOGY_VERSION = "yd-native-leader-equivalence-1.0.0" as const;

const APPLICATION_KEYS = new Set([
  "channel",
  "combination",
  "effectGroupId",
  "effect",
  "triggerGroupId",
  "trigger",
  "target",
]);
const EFFECT_KEYS = new Set([
  "id",
  "family",
  "kind",
  "value",
  "unit",
  "targetId",
  "description",
  "sourceRef",
]);
const TRIGGER_KEYS = new Set([
  "id",
  "kind",
  "threshold",
  "attribute",
  "characterGroupingId",
  "characterIds",
  "judgementType",
  "description",
  "sourceRef",
]);
const TARGET_KEYS = new Set([
  "id",
  "kind",
  "attribute",
  "characterGroupingId",
  "count",
  "description",
  "sourceRef",
]);

const IDENTITY_NEUTRAL_TRIGGER_KINDS = new Set([
  "combo-at-least",
  "deck-attribute-count",
  "deck-character-group-count",
  "judgement-at-least",
  "life-at-least",
  "life-at-most",
  "music-character",
]);
const IDENTITY_SENSITIVE_TRIGGER_KINDS = new Set([
  "leader-character",
  "leader-character-group",
]);
const SUPPORTED_TARGET_KINDS = new Set(["all", "self", "attribute", "character-group"]);
const SUPPORTED_EFFECT_KINDS = new Set([
  "score-up",
  "score-support",
  "activation-rate-up",
  "judgement-enhance",
  "life-recovery",
  "performance-up",
  "technique-up",
  "sense-up",
  "all-parameters-up",
  "active-skill-effect-up",
]);

type SkillApplication = CardMechanics["leaderOutfit"]["applications"][number];

export type NativeLeaderEquivalenceClass = Readonly<{
  signature: string;
  representativeCardId: string;
  eligibleCardIds: readonly string[];
  /** Identity is part of the proof key; different Leader talents never merge. */
  leaderTalentIds: readonly string[];
  /** Count is retained so class/team and Outfit/team pairs can be reconciled. */
  multiplicity: number;
}>;

export type NativeLeaderEquivalenceResult = Readonly<{
  kind: "native-leader-equivalence";
  methodologyVersion: typeof METHODOLOGY_VERSION;
  eligibleCardIds: readonly string[];
  classes: readonly NativeLeaderEquivalenceClass[];
  fallback: Readonly<{
    singletonOnly: boolean;
    reasons: readonly string[];
  }>;
  counts: Readonly<{
    eligibleLeaderOutfits: number;
    equivalenceClasses: number;
    collapsedLeaderOutfits: number;
  }>;
}>;

export type NativeLeaderEquivalenceInput = Readonly<{
  eligibleLeaderOutfitCardIds: readonly string[];
  /** Test/research injection boundary. Production callers use the pinned mechanics catalog. */
  cards?: readonly CardMechanics[];
}>;

function unknownKeys(value: object, supported: ReadonlySet<string>): string[] {
  return Object.keys(value).filter((key) => !supported.has(key)).sort();
}

function allApplications(card: CardMechanics): SkillApplication[] {
  return [
    ...card.leaderOutfit.applications,
    ...card.skills.active.flatMap((level) => level.applications),
    ...card.skills.passive.flatMap((level) => level.applications),
    ...card.skills.special.flatMap((level) => level.applications),
  ];
}

/**
 * Leader identity is currently consumed only by Skill triggers. If the pinned
 * catalog gains an identity-sensitive or structurally unknown application,
 * equivalence is disabled rather than assuming two Outfit IDs remain
 * interchangeable under a future utility implementation.
 */
function catalogFallbackReasons(cards: readonly CardMechanics[]): string[] {
  const reasons = new Set<string>();
  for (const card of cards) {
    for (const application of allApplications(card)) {
      const applicationUnknown = unknownKeys(application, APPLICATION_KEYS);
      if (applicationUnknown.length > 0) {
        reasons.add(`unknown-application-fields:${applicationUnknown.join(",")}`);
      }
      if (application.effect) {
        const effectUnknown = unknownKeys(application.effect, EFFECT_KEYS);
        if (effectUnknown.length > 0) {
          reasons.add(`unknown-effect-fields:${effectUnknown.join(",")}`);
        }
        if (!SUPPORTED_EFFECT_KINDS.has(String(application.effect.kind))) {
          reasons.add(`unknown-effect-kind:${String(application.effect.kind)}`);
        }
      }
      if (application.trigger) {
        const triggerUnknown = unknownKeys(application.trigger, TRIGGER_KEYS);
        if (triggerUnknown.length > 0) {
          reasons.add(`unknown-trigger-fields:${triggerUnknown.join(",")}`);
        }
        const triggerKind = String(application.trigger.kind);
        if (IDENTITY_SENSITIVE_TRIGGER_KINDS.has(triggerKind)) {
          reasons.add(`identity-sensitive-trigger:${triggerKind}`);
        } else if (!IDENTITY_NEUTRAL_TRIGGER_KINDS.has(triggerKind)) {
          reasons.add(`unknown-trigger-kind:${triggerKind}`);
        }
      }
      if (application.target) {
        const targetUnknown = unknownKeys(application.target, TARGET_KEYS);
        if (targetUnknown.length > 0) {
          reasons.add(`unknown-target-fields:${targetUnknown.join(",")}`);
        }
        const targetKind = String(application.target.kind);
        if (!SUPPORTED_TARGET_KINDS.has(targetKind)) {
          reasons.add(`unknown-target-kind:${targetKind}`);
        }
      }
    }
  }
  return [...reasons].sort();
}

function utilityApplication(application: SkillApplication): unknown {
  return {
    channel: application.channel,
    combination: application.combination,
    effectGroupId: application.effectGroupId,
    triggerGroupId: application.triggerGroupId,
    effect: application.effect
      ? {
          id: application.effect.id,
          family: application.effect.family,
          kind: application.effect.kind,
          value: application.effect.value,
          unit: application.effect.unit,
          targetId: application.effect.targetId,
        }
      : null,
    trigger: application.trigger
      ? {
          kind: application.trigger.kind,
          threshold: application.trigger.threshold,
          attribute: application.trigger.attribute,
          characterGroupingId: application.trigger.characterGroupingId,
          characterIds: application.trigger.characterIds,
          judgementType: application.trigger.judgementType,
        }
      : null,
    target: application.target
      ? {
          id: application.target.id,
          kind: application.target.kind,
          attribute: application.target.attribute,
          characterGroupingId: application.target.characterGroupingId,
          count: application.target.count,
        }
      : null,
  };
}

function structuralSignature(card: CardMechanics): string {
  const publicCard = publicCardById.get(card.cardId);
  // Array order and group IDs are intentionally retained because application
  // override/deduplication semantics consume both.  The Leader talent and the
  // target/singer-relevant topology are deliberately included even when the
  // current utility does not consume every field: this is a proof key, not an
  // opportunistic cache key.  It is therefore safe to leave equivalence gains
  // on the table rather than collapse identity-distinct Leader sources.
  return `leader-utility:${JSON.stringify({
    leaderTalentId: card.talentId,
    leaderAttribute: publicCard?.attribute ?? null,
    leaderGroups: publicCard ? [...publicCard.groups].sort() : [],
    applications: card.leaderOutfit.applications.map(utilityApplication),
  })}`;
}

export function compileNativeLeaderEquivalence(
  input: NativeLeaderEquivalenceInput,
): NativeLeaderEquivalenceResult {
  const cards = input.cards ?? mechanicsData.cards;
  const cardById = new Map(cards.map((card) => [card.cardId, card]));
  const eligibleCardIds = [...input.eligibleLeaderOutfitCardIds].sort((left, right) =>
    left.localeCompare(right),
  );
  if (eligibleCardIds.length === 0) {
    throw new Error("Leader equivalence requires at least one eligible Leader/Outfit");
  }
  if (new Set(eligibleCardIds).size !== eligibleCardIds.length) {
    throw new Error("Eligible Leader/Outfit IDs must be unique");
  }
  for (const cardId of eligibleCardIds) {
    if (!cardById.has(cardId)) throw new Error(`Unknown eligible Leader/Outfit: ${cardId}`);
  }

  const reasons = catalogFallbackReasons(cards);
  const singletonOnly = reasons.length > 0;
  const membersBySignature = new Map<string, string[]>();
  for (const cardId of eligibleCardIds) {
    const signature = singletonOnly
      ? `leader-singleton:${cardId}`
      : structuralSignature(cardById.get(cardId)!);
    const members = membersBySignature.get(signature) ?? [];
    members.push(cardId);
    membersBySignature.set(signature, members);
  }
  const classes = [...membersBySignature.entries()]
    .map(([signature, memberIds]): NativeLeaderEquivalenceClass => {
      const sorted = [...memberIds].sort((left, right) => left.localeCompare(right));
      return {
        signature,
        representativeCardId: sorted[0]!,
        eligibleCardIds: sorted,
        leaderTalentIds: [...new Set(sorted.map((cardId) => cardById.get(cardId)!.talentId))]
          .sort((left, right) => left.localeCompare(right)),
        multiplicity: sorted.length,
      };
    })
    .sort((left, right) => left.representativeCardId.localeCompare(right.representativeCardId));

  return {
    kind: "native-leader-equivalence",
    methodologyVersion: METHODOLOGY_VERSION,
    eligibleCardIds,
    classes,
    fallback: { singletonOnly, reasons },
    counts: {
      eligibleLeaderOutfits: eligibleCardIds.length,
      equivalenceClasses: classes.length,
      collapsedLeaderOutfits: eligibleCardIds.length - classes.length,
    },
  };
}
