import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGithubRaw } from "./lib/fetch-github-raw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = join(root, "data", "generated", "holodori-mechanics.json");

const sourceSnapshot = {
  repository: "https://github.com/HolodoriDB/holodori-db-eng-diff",
  commit: "95e08ebe8f5b0bec83af036230f10291726b7130",
  masterVersion: "fbca8c670e074558b24708bf163fff446a614f709afa9d1784395a15444121b0",
};

const retrievedAt = process.argv
  .find((argument) => argument.startsWith("--retrieved-at="))
  ?.split("=")[1] ?? new Date().toISOString().slice(0, 10);

const tableFiles = [
  "Card.json",
  "CardLevel.json",
  "CardLevelLimit.json",
  "CardPotential.json",
  "Costume.json",
  "LiveActiveSkillEffect.json",
  "LiveActiveSkillLevel.json",
  "LiveLeaderSkill.json",
  "LivePassiveSkillEffect.json",
  "LivePassiveSkillLevel.json",
  "LiveSkillEffectTarget.json",
  "LiveSkillTrigger.json",
  "LiveSpecialSkillLevel.json",
  "SkillTreeConnectEffect.json",
  "SkillTreeConnectEffectExtent.json",
  "SkillTreeEffect.json",
  "SkillTreeEffectPassiveTrigger.json",
  "SkillTreeEffectTarget.json",
  "SkillTreeEffectValueLimit.json",
  "SkillTreeNode.json",
  "SkillTreeNodePosition.json",
  "SkillTreePoint.json",
  "Character.json",
  "CharacterLevel.json",
  "Condition.json",
];

const languageFiles = [
  "LangClientCommon_Eng.json",
  "LangGeneratedLiveActiveSkillEffect_Eng.json",
  "LangGeneratedLivePassiveSkillEffect_Eng.json",
  "LangGeneratedLiveSkillEffectTarget_Eng.json",
  "LangGeneratedLiveSkillTrigger_Eng.json",
  "LangGeneratedSkillTreeConnectEffect_Eng.json",
  "LangGeneratedSkillTreeEffect_Eng.json",
  "LangGeneratedSkillTreeEffectPassiveTrigger_Eng.json",
  "LangGeneratedSkillTreeEffectTarget_Eng.json",
  "LangGeneratedLiveActiveSkillLevel_Eng.json",
  "LangGeneratedLivePassiveSkillLevel_Eng.json",
  "LangGeneratedLiveSpecialSkillLevel_Eng.json",
  "LangGeneratedLiveLeaderSkill_Eng.json",
  "LangHelpContent_Eng.json",
  "LangSkillTreePoint_Eng.json",
];

function rawUrl(file) {
  return `${sourceSnapshot.repository.replace("github.com", "raw.githubusercontent.com")}/${sourceSnapshot.commit}/${file}`;
}

async function fetchJson(file) {
  const response = await fetchGithubRaw(rawUrl(file), {
    accept: "application/json",
    userAgent: "Yagoo-dori mechanics compiler (+https://github.com/asciisyaez/yagoo-dori)",
  });
  return response.json();
}

const pairs = await Promise.all(
  [...tableFiles, ...languageFiles].map(async (file) => [file, await fetchJson(file)]),
);
const tables = Object.fromEntries(pairs);

function rows(file) {
  return tables[file].map((record) => record.data);
}

function cleanText(value = "") {
  const cleaned = value.replace(/\[(?:\/)?[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

const textById = new Map(
  languageFiles.flatMap((file) => rows(file).map((row) => [row.id, cleanText(row.text)])),
);

function sourceId(file) {
  return `holodori-eng:${file}`;
}

const evidenceSources = [
  ...[...new Set([...tableFiles, ...languageFiles])].map((file) => ({
    id: sourceId(file),
    kind: "structured",
    url: `${sourceSnapshot.repository}/blob/${sourceSnapshot.commit}/${file}`,
    upstreamVersion: sourceSnapshot.commit,
    retrievedAt,
    transformation: "Direct ID-preserving normalization from the pinned HolodoriDB row data.",
  })),
  {
    id: "official:system",
    kind: "official",
    url: "https://www.hololive-dreams.com/en/system",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Human-reviewed corroboration for Leader Outfits, skill synergy, Board nodes, and Connect ranges.",
  },
  {
    id: "game8:skill-order",
    kind: "corroboration",
    url: "https://game8.jp/hololive-dreams/801512",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Human-reviewed corroboration for the three Member skill families and left-to-right Special order.",
  },
  {
    id: "game8:sora-card",
    kind: "corroboration",
    url: "https://game8.jp/hololive-dreams/801297",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Independent max-level parameter cross-check for the four-star Tokino Sora fixture.",
  },
  {
    id: "appmedia:score-guide",
    kind: "corroboration",
    url: "https://appmedia.jp/hololive-dreams/80248429",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Editorial cross-check only; no AppMedia ranking or weight enters the mechanics model.",
  },
  {
    id: "community:score-support-observation",
    kind: "corroboration",
    url: "https://www.reddit.com/r/Hololive_Dreams/comments/1v8x5q3/score_up_vs_score_effect_up/",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Public score observations retained as provisional evidence, not a verified runtime equation.",
  },
  {
    id: "community:passive-target-test",
    kind: "corroboration",
    url: "https://www.reddit.com/r/Hololive_Dreams/comments/1v5upec/passive_skill_question/",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Public target-selection observations retained to test candidate recipient rules.",
  },
  {
    id: "community:passive-target-counterexamples",
    kind: "corroboration",
    url: "https://www.reddit.com/r/Hololive_Dreams/comments/1v6d9uh/questions_regarding_passive_buffs/",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Public counterexamples to simple formation-order and stat-priority recipient rules.",
  },
  {
    id: "community:active-overlap-observation",
    kind: "corroboration",
    url: "https://www.reddit.com/r/Hololive_Dreams/comments/1v8shq4/a_small_understanding_on_the_rpg_element_of_the/",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Public overlap observations retained as a provisional policy, not a verified mechanic.",
  },
  {
    id: "appmedia:board-guide",
    kind: "corroboration",
    url: "https://appmedia.jp/hololive-dreams/80246215",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Human-reviewed corroboration for Board adjacency prerequisites and the point-income boundary.",
  },
  {
    id: "game8:board-connect",
    kind: "corroboration",
    url: "https://game8.jp/hololive-dreams/801796",
    upstreamVersion: `retrieved-${retrievedAt}`,
    retrievedAt,
    transformation: "Human-reviewed corroboration for cross-board Connect-card placement exclusivity.",
  },
];

const runtimeRules = [
  {
    id: "team-shape",
    status: "verified",
    blocksScoring: false,
    statement: "A Live team uses one Leader/Outfit and five Member cards.",
    sourceRefs: ["official:system", "holodori-eng:Costume.json", "holodori-eng:Card.json", "holodori-eng:LangHelpContent_Eng.json"],
  },
  {
    id: "unique-member-talents",
    status: "corroborated",
    blocksScoring: false,
    statement: "The five Member slots cannot contain two cards for the same talent; the separate Leader may match a Member talent.",
    sourceRefs: ["holodori-eng:LangClientCommon_Eng.json", "holodori-eng:LangHelpContent_Eng.json", "game8:skill-order"],
  },
  {
    id: "member-skill-families",
    status: "verified",
    blocksScoring: false,
    statement: "Member cards have Active, Passive, and once-per-Live Special skills.",
    sourceRefs: ["game8:skill-order", "holodori-eng:Card.json", "holodori-eng:LangHelpContent_Eng.json"],
  },
  {
    id: "active-probability-tiers",
    // The ...PermilMultiply suffix is unexplained upstream, but Setting.json
    // carries no base activation-probability constant for it to multiply, and
    // the three observed values order exactly against the Low/Medium/High
    // probability words in the English skill text - so the model reads the
    // permil as the absolute per-check activation probability.
    status: "corroborated",
    blocksScoring: false,
    statement: "LiveActiveSkillLevel.activationProbabilityPermilMultiply takes exactly the values 370, 460, and 550, rendered in skill text as Low, Medium, and High Probability; the pinned settings table carries no base activation-probability constant for it to multiply, so the value is read as the absolute per-check activation probability.",
    sourceRefs: ["holodori-eng:LiveActiveSkillLevel.json", "holodori-eng:LangGeneratedLiveActiveSkillLevel_Eng.json"],
  },
  {
    id: "member-upgrade-bonus-neutralized",
    status: "verified",
    blocksScoring: false,
    statement: "Every owned Member at level 20 or above contributes a collection-wide Unit Score multiplier (CardLevel.liveDeckPowerPermyriadUp), summed across the whole collection and capped at 50%; because it multiplies every compared formation equally, the model holds it declared-neutral at zero in all relative comparisons.",
    sourceRefs: ["holodori-eng:CardLevel.json", "holodori-eng:LangHelpContent_Eng.json"],
  },
  {
    id: "card-parameter-formula",
    status: "verified",
    blocksScoring: false,
    statement: "Each parameter is the ceiling of the level base multiplied by the card's Performance, Technique, or Sense permil distribution and its potential all-parameter multiplier.",
    sourceRefs: ["holodori-eng:Card.json", "holodori-eng:CardLevel.json", "holodori-eng:CardPotential.json", "game8:sora-card"],
  },
  {
    id: "parameter-and-attribute-roles",
    status: "verified",
    blocksScoring: false,
    statement: "Performance, Technique, and Sense contribute to Unit Score; Cute, Pure, and Happy are Member attributes used by skill conditions and targets, not song-affinity multipliers.",
    sourceRefs: ["holodori-eng:LangHelpContent_Eng.json", "holodori-eng:Card.json"],
  },
  {
    id: "potential-progression-order",
    status: "verified",
    blocksScoring: false,
    statement: "Potential stages independently unlock Active level 2, all parameters +10%, Special level 2, Passive level 2, then Connect effect level 2.",
    sourceRefs: ["holodori-eng:CardPotential.json", "holodori-eng:LangHelpContent_Eng.json"],
  },
  {
    id: "special-left-to-right-order",
    status: "corroborated",
    blocksScoring: false,
    statement: "Special skills resolve in Member formation order from left to right; Leader selection does not set that order.",
    sourceRefs: ["game8:skill-order"],
  },
  {
    id: "board-connect-amplification",
    status: "corroborated",
    blocksScoring: false,
    statement: "Cards placed in Connect nodes amplify Board effects inside the card-specific extent.",
    sourceRefs: ["official:system", "holodori-eng:SkillTreeConnectEffect.json", "holodori-eng:SkillTreeConnectEffectExtent.json"],
  },
  {
    id: "board-derived-adjacency",
    status: "corroborated",
    blocksScoring: false,
    statement: "A Board node can be unlocked only when an orthogonal-unit-neighbor path of unlocked nodes connects it to the free start Connect Node S-001; the neighbor relation is derived from SkillTreeNodePosition grid coordinates, not a published prerequisite table, and the derived edge set is identical across all four tree models.",
    sourceRefs: ["holodori-eng:SkillTreeNodePosition.json", "holodori-eng:SkillTreeNode.json", "appmedia:board-guide"],
  },
  {
    id: "board-point-budget-by-rank",
    // Corroborated, not verified: the 361-point cumulative sum is read directly
    // from CharacterLevel rows, but "this table IS the Holomem Rank income" and
    // "one independent pool per talent" are readings of a one-row-per-character
    // table corroborated by the wiki guide, not statements the pinned
    // structured files make themselves.
    status: "corroborated",
    blocksScoring: false,
    statement: "Per-talent Board Pt income follows the CharacterLevel Holomem Rank table, with 361 cumulative points at Holomem Rank 50; SkillTreePoint provides one independent point pool for each of the 54 talents.",
    sourceRefs: ["holodori-eng:CharacterLevel.json", "holodori-eng:SkillTreePoint.json", "appmedia:board-guide"],
  },
  {
    id: "board-achievement-point-income",
    // The game's own help text attributes Board Points to Holomem Rank
    // increases and routes achievement/exchange rewards to node unlock
    // MATERIALS, matching the SkillTreeNode split between
    // consumptionSkillTreePointQuantity and the item consumptions array - so
    // no additional point channel is documented, and the 86-point gap between
    // rank income (361) and the full board (447) may simply be unreachable.
    // A wiki guide claims extra point income; the help text contradicts it.
    status: "unresolved",
    blocksScoring: false,
    statement: "The complete per-talent Board costs 447 points while Holomem Rank income reaches 361; the help text attributes Board Points to rank increases and routes achievement and exchange rewards to unlock materials, documenting no additional point channel, so any extra points a user holds must be user-declared rather than assumed.",
    sourceRefs: ["holodori-eng:LangHelpContent_Eng.json", "holodori-eng:SkillTreeNode.json", "appmedia:board-guide"],
  },
  {
    id: "board-connect-placement-exclusivity",
    status: "corroborated",
    blocksScoring: false,
    statement: "A card placed in a Connect Node on one member's Board cannot be placed on another member's Board; whether that card can simultaneously remain in the active unit is publicly undocumented.",
    sourceRefs: ["game8:board-connect"],
  },
  {
    id: "board-stat-stacking",
    status: "unresolved",
    blocksScoring: false,
    statement: "How Board flat and permil boosts combine with other card and Leader effects is undocumented; Board recommendations use a conservative additive envelope and do not claim jointly attainable or absolute stat totals.",
    sourceRefs: ["official:system", "appmedia:board-guide"],
  },
  {
    id: "active-conditional-override",
    status: "verified",
    blocksScoring: false,
    statement: "A conditional additional Active Score Up replaces the primary Score Up value while its condition passes; the two values are not added.",
    sourceRefs: ["holodori-eng:LiveActiveSkillLevel.json", "holodori-eng:LiveActiveSkillEffect.json"],
  },
  {
    id: "leader-conditional-coeffects",
    status: "verified",
    blocksScoring: false,
    statement: "When a Leader skill has two differently typed effects behind the same condition, both effects coexist while that condition passes.",
    sourceRefs: ["holodori-eng:LiveLeaderSkill.json", "holodori-eng:LivePassiveSkillEffect.json"],
  },
  {
    id: "runtime-score-equation",
    status: "unresolved",
    blocksScoring: true,
    statement: "The complete note-score equation, operation order, and rounding are not durably documented.",
    sourceRefs: ["appmedia:score-guide"],
  },
  {
    id: "score-support-combination",
    status: "corroborated",
    blocksScoring: false,
    statement: "Public observations support adding simultaneous Score Support sources, then multiplying the selected Active Score Up bonus by one plus that support total; exact rounding remains unresolved.",
    sourceRefs: ["community:score-support-observation"],
  },
  {
    id: "passive-target-selection-order",
    status: "unresolved",
    blocksScoring: true,
    statement: "When eligible Members exceed a target cap, public counterexamples reject simple formation-order, highest-stat, total-stat, lowest-stat, rarity, and level priorities; the exact recipient resolver remains unknown.",
    sourceRefs: ["holodori-eng:LiveSkillEffectTarget.json", "community:passive-target-test", "community:passive-target-counterexamples"],
  },
  {
    id: "effect-stacking-and-rounding",
    status: "unresolved",
    blocksScoring: true,
    statement: "The exact additive or multiplicative stacking order and intermediate rounding require validation.",
    sourceRefs: ["holodori-eng:LiveActiveSkillEffect.json", "holodori-eng:LivePassiveSkillEffect.json"],
  },
  {
    id: "special-timeline",
    status: "unresolved",
    blocksScoring: true,
    statement: "Specials resolve left to right at chart rainbow markers; public aggregate charts do not expose those marker times, so sequential windows beginning at time zero must not be invented.",
    sourceRefs: ["game8:skill-order"],
  },
  {
    id: "active-skill-collision",
    status: "unresolved",
    blocksScoring: true,
    statement: "Public observations suggest only the strongest overlapping Active Score Up applies, but whether comparison happens before or after Score Support and how ties resolve require controlled validation.",
    sourceRefs: ["holodori-eng:LiveActiveSkillLevel.json", "community:active-overlap-observation"],
  },
  {
    id: "timed-note-events",
    status: "unresolved",
    blocksScoring: true,
    statement: "Public structured chart aggregates do not include note-event timestamps.",
    sourceRefs: [],
  },
  {
    id: "auto-live-skill-policy",
    // The in-game help and FAQ document the policy (Auto applies Perfect-gated
    // effects, per faq-live and help-rhythm), and the songs artifact encodes it
    // as rules.autoLive; the full enabled-effect set on Auto still lacks a
    // client-side observation, so this stays short of verified.
    status: "corroborated",
    blocksScoring: true,
    statement: "Auto Live scoring coefficients exist and the help text documents Auto as satisfying Perfect-gated effects, but the exact set of enabled skill effects on Auto still requires client-side validation.",
    sourceRefs: ["holodori-eng:LangHelpContent_Eng.json"],
  },
];

const activeKindByType = {
  LiveActiveSkillEffectType_LIVE_ACTIVE_SKILL_EFFECT_TYPE_SCORE_UP_PERMIL_UP: "score-up",
  LiveActiveSkillEffectType_LIVE_ACTIVE_SKILL_EFFECT_TYPE_SCORE_UP_EFFECT_UP_PERMIL_UP: "score-support",
  LiveActiveSkillEffectType_LIVE_ACTIVE_SKILL_EFFECT_TYPE_LIVE_ACTIVE_SKILL_ACTIVATION_PROBABILITY_UP_PERMIL_UP: "activation-rate-up",
  LiveActiveSkillEffectType_LIVE_ACTIVE_SKILL_EFFECT_TYPE_JUDGEMENT_ENHANCE: "judgement-enhance",
  LiveActiveSkillEffectType_LIVE_ACTIVE_SKILL_EFFECT_TYPE_LIFE_RECOVERY: "life-recovery",
};

const passiveKindByType = {
  LivePassiveSkillEffectType_LIVE_PASSIVE_SKILL_EFFECT_TYPE_PERFORMANCE_UP_PERMIL_UP: "performance-up",
  LivePassiveSkillEffectType_LIVE_PASSIVE_SKILL_EFFECT_TYPE_TECHNIQUE_UP_PERMIL_UP: "technique-up",
  LivePassiveSkillEffectType_LIVE_PASSIVE_SKILL_EFFECT_TYPE_SENSE_UP_PERMIL_UP: "sense-up",
  LivePassiveSkillEffectType_LIVE_PASSIVE_SKILL_EFFECT_TYPE_ALL_PARAMETER_UP_PERMIL_UP: "all-parameters-up",
  LivePassiveSkillEffectType_LIVE_PASSIVE_SKILL_EFFECT_TYPE_LIVE_ACTIVE_SKILL_EFFECT_UP_PERMIL_UP: "active-skill-effect-up",
};

const targetKindByType = {
  LiveSkillEffectTargetType_LIVE_SKILL_EFFECT_TARGET_TYPE_ALL: "all",
  LiveSkillEffectTargetType_LIVE_SKILL_EFFECT_TARGET_TYPE_SELF: "self",
  LiveSkillEffectTargetType_LIVE_SKILL_EFFECT_TARGET_TYPE_ATTRIBUTE: "attribute",
  LiveSkillEffectTargetType_LIVE_SKILL_EFFECT_TARGET_TYPE_CHARACTER_GROUPING: "character-group",
};

const triggerKindByType = {
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_COMBO_GTE: "combo-at-least",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_DECK_CARD_ATTRIBUTE: "deck-attribute-count",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_DECK_CARD_CHARACTER_GROUPING: "deck-character-group-count",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_DECK_LEADER_CHARACTER: "leader-character",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_DECK_LEADER_CHARACTER_GROUPING: "leader-character-group",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_JUDGEMENT_TYPE_GTE: "judgement-at-least",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_LIFE_GTE: "life-at-least",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_LIFE_LTE: "life-at-most",
  LiveSkillTriggerType_LIVE_SKILL_TRIGGER_TYPE_MUSIC_CHARACTER: "music-character",
};

const potentialKindByType = {
  CardPotentialEffectType_CARD_POTENTIAL_EFFECT_TYPE_ACTIVE_SKILL_LEVEL_UP: "active-skill-level-up",
  CardPotentialEffectType_CARD_POTENTIAL_EFFECT_TYPE_ALL_PARAMETER_UP_PERMIL_UP: "all-parameters-up",
  CardPotentialEffectType_CARD_POTENTIAL_EFFECT_TYPE_SPECIAL_SKILL_LEVEL_UP: "special-skill-level-up",
  CardPotentialEffectType_CARD_POTENTIAL_EFFECT_TYPE_PASSIVE_SKILL_LEVEL_UP: "passive-skill-level-up",
  CardPotentialEffectType_CARD_POTENTIAL_EFFECT_TYPE_SKILL_TREE_CONNECT_EFFECT_LEVEL_UP: "connect-effect-level-up",
};

function requiredKind(mapping, value, catalog) {
  const kind = mapping[value];
  if (!kind) throw new Error(`Unmapped ${catalog} enum: ${value}`);
  return kind;
}

function enumSuffix(value, marker, catalog) {
  if (!value?.includes(marker)) throw new Error(`Unmapped ${catalog} enum: ${value}`);
  return value.split(marker)[1].toLowerCase().replaceAll("_", "-");
}

const attributeByType = {
  CardAttributeType_CARD_ATTRIBUTE_TYPE_ATTRIBUTE_1: "cute",
  CardAttributeType_CARD_ATTRIBUTE_TYPE_ATTRIBUTE_2: "pure",
  CardAttributeType_CARD_ATTRIBUTE_TYPE_ATTRIBUTE_3: "happy",
};

function normalizeTarget(row) {
  return {
    id: row.id,
    kind: requiredKind(targetKindByType, row.type, "Live target"),
    attribute: row.cardAttributeType ? attributeByType[row.cardAttributeType] : null,
    characterGroupingId: row.characterGroupingId ?? null,
    count: row.targetCount === undefined ? null : Number(row.targetCount),
    description: textById.get(row.descriptionLangId) ?? null,
    sourceRef: sourceId("LiveSkillEffectTarget.json"),
  };
}

function normalizeTrigger(row) {
  return {
    id: row.groupId,
    kind: requiredKind(triggerKindByType, row.type, "Live trigger"),
    threshold: row.threshold === undefined ? null : Number(row.threshold),
    attribute: row.cardAttributeType ? attributeByType[row.cardAttributeType] : null,
    characterGroupingId: row.characterGroupingId ?? null,
    characterIds: row.characterIds ?? [],
    judgementType: row.liveNoteJudgementType ?? null,
    description: textById.get(row.descriptionLangId) ?? null,
    sourceRef: sourceId("LiveSkillTrigger.json"),
  };
}

const activeEffects = rows("LiveActiveSkillEffect.json").map((row) => ({
  id: row.groupId,
  family: "active",
  kind: requiredKind(activeKindByType, row.type, "Active effect"),
  value: row.value === undefined ? null : Number(row.value),
  unit: row.type.endsWith("LIFE_RECOVERY") ? "flat" : row.value === undefined ? "none" : "permil",
  targetId: null,
  description: textById.get(row.descriptionLangId) ?? null,
  sourceRef: sourceId("LiveActiveSkillEffect.json"),
}));

const passiveEffects = rows("LivePassiveSkillEffect.json").map((row) => ({
  id: row.groupId,
  family: "passive",
  kind: requiredKind(passiveKindByType, row.type, "Passive effect"),
  value: Number(row.value),
  unit: "permil",
  targetId: row.liveSkillEffectTargetId,
  description: textById.get(row.descriptionLangId) ?? null,
  sourceRef: sourceId("LivePassiveSkillEffect.json"),
}));

const targets = rows("LiveSkillEffectTarget.json").map(normalizeTarget);
const triggers = rows("LiveSkillTrigger.json").map(normalizeTrigger);
const activeEffectById = new Map(activeEffects.map((effect) => [effect.id, effect]));
const passiveEffectById = new Map(passiveEffects.map((effect) => [effect.id, effect]));
const targetById = new Map(targets.map((target) => [target.id, target]));
const triggerById = new Map(triggers.map((trigger) => [trigger.id, trigger]));

const potentialEffects = rows("CardPotential.json").map((row) => ({
  id: `${row.groupId}:${row.upgradeCount}`,
  groupId: row.groupId,
  stage: Number(row.upgradeCount),
  kind: requiredKind(potentialKindByType, row.effectType, "Potential effect"),
  value: Number(row.value),
  sourceRef: sourceId("CardPotential.json"),
}));

const connectEffects = rows("SkillTreeConnectEffect.json").map((row) => ({
  id: row.id,
  level: Number(row.level),
  kind: enumSuffix(row.connectEffectType, "SKILL_TREE_CONNECT_EFFECT_TYPE_", "Connect effect"),
  extentId: row.skillTreeConnectEffectExtentGroupId,
  valuePermil: Number(row.effectPermilUp),
  description: textById.get(row.descriptionLangId) ?? null,
  sourceRef: sourceId("SkillTreeConnectEffect.json"),
}));

const connectExtentGroups = new Map();
for (const row of rows("SkillTreeConnectEffectExtent.json")) {
  const positions = connectExtentGroups.get(row.groupId) ?? [];
  positions.push({ x: Number(row.positionX ?? 0), y: Number(row.positionY ?? 0) });
  connectExtentGroups.set(row.groupId, positions);
}
const connectExtents = [...connectExtentGroups].map(([id, positions]) => ({
  id,
  positions: positions.sort((left, right) => left.y - right.y || left.x - right.x),
  sourceRef: sourceId("SkillTreeConnectEffectExtent.json"),
}));

const boardEffects = rows("SkillTreeEffect.json").map((row) => ({
  id: row.id,
  kind: enumSuffix(row.effectType, "SKILL_TREE_EFFECT_TYPE_", "Board effect"),
  value: row.value === undefined ? null : Number(row.value),
  targetId: row.skillTreeEffectTargetId ?? null,
  passiveTriggerId: row.skillTreeEffectPassiveTriggerGroupId ?? null,
  characterTrigger: enumSuffix(row.characterTriggerType, "SKILL_TREE_EFFECT_CHARACTER_TRIGGER_TYPE_", "Board character trigger"),
  description: textById.get(row.descriptionLangId) ?? null,
  // Carried so the leader-skill-grant effect kind is representable: two rows
  // grant the Leader an additional Live Active skill by id.
  liveActiveSkillId: row.liveActiveSkillId ?? null,
  sourceRef: sourceId("SkillTreeEffect.json"),
}));

const boardPassiveTriggers = rows("SkillTreeEffectPassiveTrigger.json").map((row) => ({
  id: row.groupId,
  kind: enumSuffix(row.type, "SKILL_TREE_EFFECT_PASSIVE_TRIGGER_TYPE_", "Board passive trigger"),
  characterIds: row.characterIds ?? [],
  characterGroupingId: row.characterGroupingId ?? null,
  musicSingerType: row.musicSingerType ?? null,
  description: textById.get(row.descriptionLangId) ?? null,
  sourceRef: sourceId("SkillTreeEffectPassiveTrigger.json"),
}));

const boardTargets = rows("SkillTreeEffectTarget.json").map((row) => ({
  id: row.id,
  kind: enumSuffix(row.type, "SKILL_TREE_EFFECT_TARGET_TYPE_", "Board target"),
  characterId: row.characterId ?? null,
  characterGroupingId: row.characterGroupingId ?? null,
  description: textById.get(row.descriptionLangId) ?? null,
  sourceRef: sourceId("SkillTreeEffectTarget.json"),
}));

const boardValueLimits = rows("SkillTreeEffectValueLimit.json").map((row) => ({
  kind: enumSuffix(row.skillTreeEffectType, "SKILL_TREE_EFFECT_TYPE_", "Board value limit"),
  limit: Number(row.limit),
  sourceRef: sourceId("SkillTreeEffectValueLimit.json"),
}));

const boardNodes = rows("SkillTreeNode.json").map((row) => ({
  id: `${row.groupId}:${row.number}`,
  groupId: row.groupId,
  number: Number(row.number),
  kind: enumSuffix(row.type, "SKILL_TREE_NODE_TYPE_", "Board node"),
  grade: Number(row.grade),
  effectId: row.skillTreeEffectId ?? null,
  characterIds: row.characterIds ?? [],
  pointCost: Number(row.consumptionSkillTreePointQuantity ?? 0),
  itemCosts: (row.consumptions ?? []).map((consumption) => ({
    resourceType: enumSuffix(consumption.resourceType, "RESOURCE_TYPE_", "Board node consumption"),
    resourceId: consumption.resourceId,
    quantity: Number(consumption.quantity),
  })),
  viewConditionGroupId: row.viewConditionGroupId ?? null,
  unlockConditionGroupId: row.unlockConditionGroupId ?? null,
  autoSelectionPriority:
    row.autoSelectionPriority === undefined ? null : Number(row.autoSelectionPriority),
  sourceRef: sourceId("SkillTreeNode.json"),
}));

const boardNodePositions = rows("SkillTreeNodePosition.json").map((row) => ({
  treeModelId: row.groupId,
  nodeGroupId: row.skillTreeNodeGroupId,
  x: Number(row.positionX ?? 0),
  y: Number(row.positionY ?? 0),
  sourceRef: sourceId("SkillTreeNodePosition.json"),
}));

const boardPointPools = rows("SkillTreePoint.json").map((row) => ({
  id: row.id,
  talentId: row.characterId,
  name: textById.get(row.nameLangId) ?? null,
  sourceRef: sourceId("SkillTreePoint.json"),
}));

const treeModelIds = new Set(boardNodePositions.map((position) => position.treeModelId));
const talentBoardProfiles = rows("Character.json")
  .filter((row) => row.isPlayable === true)
  .map((row) => {
    const treeModelId = row.skillTreeNodePositionGroupId;
    if (!treeModelIds.has(treeModelId)) {
      throw new Error(`Character ${row.id} references unknown tree model ${treeModelId}`);
    }
    return {
      talentId: row.id,
      treeModelId,
      sourceRef: sourceId("Character.json"),
    };
  })
  .sort((left, right) => left.talentId.localeCompare(right.talentId));

const characterLevelRows = rows("CharacterLevel.json");
const characterLevelGroups = new Set(characterLevelRows.map((row) => row.groupId));
if (characterLevelGroups.size !== 1 || !characterLevelGroups.has("level-group-1")) {
  throw new Error("CharacterLevel must contain exactly one level-group-1 catalog");
}
const holomemRankPoints = characterLevelRows
  .sort((left, right) => Number(left.level) - Number(right.level))
  .map((row) => {
    if (row.skillTreePointQuantity === undefined && Number(row.level) !== 1) {
      throw new Error(`CharacterLevel rank ${row.level} is missing skillTreePointQuantity`);
    }
    return {
      rank: Number(row.level),
      points: Number(row.skillTreePointQuantity ?? 0),
      sourceRef: sourceId("CharacterLevel.json"),
    };
  });

const boardConditionGroupIds = new Set(
  boardNodes.flatMap((node) => [node.viewConditionGroupId, node.unlockConditionGroupId]).filter(Boolean),
);
const boardNodeConditions = [...boardConditionGroupIds].sort().map((id) => {
  const matchingRows = rows("Condition.json").filter((row) => row.groupId === id);
  if (matchingRows.length !== 1) {
    throw new Error(`Board node condition ${id} must resolve to exactly one upstream row`);
  }
  const [row] = matchingRows;
  if (
    !row.type?.endsWith("CONDITION_TYPE_PLAYER_LEVEL") ||
    !row.minMaxType?.endsWith("CONDITION_MIN_MAX_TYPE_MIN") ||
    row.min === undefined
  ) {
    throw new Error(`Board node condition ${id} is not a MIN player-level condition`);
  }
  return {
    id,
    kind: "player-level-at-least",
    threshold: Number(row.min),
    sourceRef: sourceId("Condition.json"),
  };
});

function indexBy(records, field) {
  const result = new Map();
  for (const record of records) {
    const list = result.get(record[field]) ?? [];
    list.push(record);
    result.set(record[field], list);
  }
  return result;
}

const activeLevelsBySkill = indexBy(rows("LiveActiveSkillLevel.json"), "liveActiveSkillId");
const passiveLevelsBySkill = indexBy(rows("LivePassiveSkillLevel.json"), "livePassiveSkillId");
const specialLevelsBySkill = indexBy(rows("LiveSpecialSkillLevel.json"), "liveSpecialSkillId");
const levelCurveByGroup = indexBy(rows("CardLevel.json"), "groupId");
const limitBreaksByGroup = indexBy(rows("CardLevelLimit.json"), "groupId");
const potentialByGroup = indexBy(potentialEffects, "groupId");
const costumeById = new Map(rows("Costume.json").map((row) => [row.id, row]));
const leaderById = new Map(rows("LiveLeaderSkill.json").map((row) => [row.id, row]));

function compileApplication(effectGroupId, triggerGroupId, channel, combination, effectMap, unresolved) {
  if (!effectGroupId) return null;
  const effect = effectMap.get(effectGroupId);
  if (!effect) unresolved.add(effectGroupId);
  const trigger = triggerGroupId ? triggerById.get(triggerGroupId) : null;
  if (triggerGroupId && !trigger) unresolved.add(triggerGroupId);
  const target = effect?.targetId ? targetById.get(effect.targetId) : null;
  if (effect?.targetId && !target) unresolved.add(effect.targetId);
  return {
    channel,
    combination,
    effectGroupId,
    effect: effect ?? null,
    triggerGroupId: triggerGroupId ?? null,
    trigger: trigger ?? null,
    target: target ?? null,
  };
}

function compileSkillLevel(row, kind, unresolved) {
  const passive = kind === "passive";
  const effectMap = passive ? passiveEffectById : activeEffectById;
  const primaryEffectId = passive
    ? row.livePassiveSkillEffectGroupId
    : row.liveActiveSkillEffectGroupId;
  const additionalEffectId = passive
    ? row.additionalLivePassiveSkillEffectGroupId
    : row.additionalLiveActiveSkillEffectGroupId;
  if (kind === "active" && additionalEffectId && !row.additionalLiveSkillTriggerGroupId) {
    throw new Error(`${row.liveActiveSkillId} has an Active override without a condition`);
  }
  const applications = [
    compileApplication(
      primaryEffectId,
      row.liveSkillTriggerGroupId,
      "primary",
      row.liveSkillTriggerGroupId ? "conditional-base" : "base",
      effectMap,
      unresolved,
    ),
    compileApplication(
      additionalEffectId,
      row.additionalLiveSkillTriggerGroupId,
      "additional",
      kind === "active"
        ? "conditional-override"
        : row.additionalLiveSkillTriggerGroupId
          ? "conditional-additive"
          : "additive",
      effectMap,
      unresolved,
    ),
  ].filter(Boolean);
  return {
    kind,
    level: Number(row.level),
    description: textById.get(row.descriptionLangId) ?? null,
    cooldownMilliseconds: row.coolTimeMillisecond === undefined ? null : Number(row.coolTimeMillisecond),
    durationMilliseconds: row.effectDurationMillisecond === undefined ? null : Number(row.effectDurationMillisecond),
    activationProbabilityPermil:
      row.activationProbabilityPermilMultiply === undefined
        ? null
        : Number(row.activationProbabilityPermilMultiply),
    applications,
  };
}

function rarityFrom(value) {
  return Number(value.match(/RARITY_(\d)$/)?.[1] ?? 0);
}

const blockingRuleIds = runtimeRules
  .filter((rule) => rule.status === "unresolved" && rule.blocksScoring)
  .map((rule) => rule.id);
const unresolvedReferences = new Set();

const cards = rows("Card.json")
  .filter((row) => [4, 5].includes(rarityFrom(row.rarity)))
  .map((row) => {
    const unresolved = new Set();
    const costume = costumeById.get(row.rewardCostumeId);
    const leader = costume?.liveLeaderSkillId ? leaderById.get(costume.liveLeaderSkillId) : null;
    if (!costume) unresolved.add(row.rewardCostumeId);
    if (!leader) unresolved.add(costume?.liveLeaderSkillId ?? `${row.id}:leader`);
    if (leader?.additionalLivePassiveSkillEffectGroupId) {
      if (
        !leader.additionalLiveSkillTriggerGroupId ||
        leader.additionalLiveSkillTriggerGroupId !== leader.liveSkillTriggerGroupId
      ) {
        throw new Error(`${leader.id} has unexpected Leader co-effect trigger semantics`);
      }
    }

    const active = (activeLevelsBySkill.get(row.liveActiveSkillId) ?? [])
      .sort((left, right) => Number(left.level) - Number(right.level))
      .map((level) => compileSkillLevel(level, "active", unresolved));
    const passive = (passiveLevelsBySkill.get(row.livePassiveSkillId) ?? [])
      .sort((left, right) => Number(left.level) - Number(right.level))
      .map((level) => compileSkillLevel(level, "passive", unresolved));
    const special = (specialLevelsBySkill.get(row.liveSpecialSkillId) ?? [])
      .sort((left, right) => Number(left.level) - Number(right.level))
      .map((level) => compileSkillLevel(level, "special", unresolved));

    const leaderApplications = leader
      ? [
          compileApplication(
            leader.livePassiveSkillEffectGroupId,
            leader.liveSkillTriggerGroupId,
            "primary",
            leader.liveSkillTriggerGroupId ? "conditional-base" : "base",
            passiveEffectById,
            unresolved,
          ),
          compileApplication(
            leader.additionalLivePassiveSkillEffectGroupId,
            leader.additionalLiveSkillTriggerGroupId,
            "additional",
            leader.additionalLiveSkillTriggerGroupId ? "conditional-additive" : "additive",
            passiveEffectById,
            unresolved,
          ),
        ].filter(Boolean)
      : [];

    const levelCurve = (levelCurveByGroup.get(row.cardLevelGroupId) ?? [])
      .sort((left, right) => Number(left.level) - Number(right.level))
      .map((level) => ({
        level: Number(level.level),
        parameterBaseValue: Number(level.parameterBaseValue),
        liveDeckPowerPermyriadUp: Number(level.liveDeckPowerPermyriadUp ?? 0),
      }));
    const limitBreaks = (limitBreaksByGroup.get(row.cardLevelLimitGroupId) ?? [])
      .sort((left, right) => Number(left.limitBreakCount ?? 0) - Number(right.limitBreakCount ?? 0))
      .map((limit) => ({
        limitBreakCount: Number(limit.limitBreakCount ?? 0),
        levelLimit: Number(limit.levelLimit),
      }));
    const potential = (potentialByGroup.get(row.cardPotentialGroupId) ?? [])
      .sort((left, right) => left.stage - right.stage);
    const cardConnectLevels = connectEffects
      .filter((effect) => effect.id === row.skillTreeConnectEffectId)
      .sort((left, right) => left.level - right.level);
    if (cardConnectLevels.length === 0) unresolved.add(row.skillTreeConnectEffectId);
    for (const effect of cardConnectLevels) {
      if (!connectExtentGroups.has(effect.extentId)) unresolved.add(effect.extentId);
    }
    if (active.length === 0) unresolved.add(row.liveActiveSkillId);
    if (passive.length === 0) unresolved.add(row.livePassiveSkillId);
    if (special.length === 0) unresolved.add(row.liveSpecialSkillId);

    const maxLevel = Math.max(...levelCurve.map((level) => level.level));
    const maxPotentialValue = (kind, fallback) =>
      Math.max(fallback, ...potential.filter((effect) => effect.kind === kind).map((effect) => effect.value));

    const unresolvedReferenceIds = [...unresolved].sort();
    for (const reference of unresolvedReferenceIds) unresolvedReferences.add(reference);
    return {
      cardId: row.id,
      talentId: row.characterId,
      rarity: rarityFrom(row.rarity),
      sourceRef: sourceId("Card.json"),
      parameterDistributionPermil: {
        performance: Number(row.performancePermilMultiply),
        technique: Number(row.techniquePermilMultiply),
        sense: Number(row.sensePermilMultiply),
      },
      parameterSourceRefs: [sourceId("Card.json"), sourceId("CardLevel.json"), sourceId("CardPotential.json")],
      progression: {
        maxLevel,
        levelCurve,
        limitBreaks,
        potential,
        oneCopy: {
          level: maxLevel,
          activeSkillLevel: 1,
          passiveSkillLevel: 1,
          specialSkillLevel: 1,
          connectEffectLevel: 1,
          allParameterPermilUp: 0,
        },
        maxPotential: {
          level: maxLevel,
          activeSkillLevel: maxPotentialValue("active-skill-level-up", 1),
          passiveSkillLevel: maxPotentialValue("passive-skill-level-up", 1),
          specialSkillLevel: maxPotentialValue("special-skill-level-up", 1),
          connectEffectLevel: maxPotentialValue("connect-effect-level-up", 1),
          allParameterPermilUp: maxPotentialValue("all-parameters-up", 0),
        },
        connectEffect: {
          id: row.skillTreeConnectEffectId,
          levels: cardConnectLevels,
        },
      },
      skills: { active, passive, special },
      leaderOutfit: {
        costumeId: costume?.id ?? row.rewardCostumeId,
        talentId: costume?.characterId ?? row.characterId,
        leaderSkillId: leader?.id ?? null,
        applications: leaderApplications,
        sourceRefs: [sourceId("Costume.json"), sourceId("LiveLeaderSkill.json")],
      },
      coverage: {
        allReferencesMapped: unresolvedReferenceIds.length === 0,
        unresolvedReferenceIds,
      },
      unresolvedRuleIds: blockingRuleIds,
      scoringEligible: false,
    };
  })
  .sort((left, right) => left.cardId.localeCompare(right.cardId));

const boardTargetIds = new Set(boardTargets.map((target) => target.id));
const boardTriggerIds = new Set(boardPassiveTriggers.map((trigger) => trigger.id));
const boardEffectIds = new Set(boardEffects.map((effect) => effect.id));
for (const effect of boardEffects) {
  if (effect.targetId && !boardTargetIds.has(effect.targetId)) unresolvedReferences.add(effect.targetId);
  if (effect.passiveTriggerId && !boardTriggerIds.has(effect.passiveTriggerId)) {
    unresolvedReferences.add(effect.passiveTriggerId);
  }
}
for (const node of boardNodes) {
  if (node.effectId && !boardEffectIds.has(node.effectId)) unresolvedReferences.add(node.effectId);
}

const payload = {
  schemaVersion: 1,
  methodologyVersion: "yd-mechanics-catalog-1.2.0",
  retrievedAt,
  sourceSnapshot,
  evidenceSources,
  runtimeRules,
  catalogs: {
    activeEffects,
    passiveEffects,
    targets,
    triggers,
    potentialEffects,
    connectEffects,
    connectExtents,
    boardEffects,
    boardPassiveTriggers,
    boardTargets,
    boardValueLimits,
    boardNodes,
    boardNodePositions,
    boardPointPools,
    talentBoardProfiles,
    holomemRankPoints,
    boardNodeConditions,
  },
  cards,
  coverage: {
    cards: cards.length,
    mappedCards: cards.filter((card) => card.coverage.allReferencesMapped).length,
    unresolvedReferences: [...unresolvedReferences].sort(),
  },
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Compiled mechanics for ${cards.length} cards; ${payload.coverage.mappedCards} fully mapped; ` +
    `${payload.coverage.unresolvedReferences.length} unresolved references.`,
);
if (payload.coverage.unresolvedReferences.length > 0) process.exitCode = 1;
