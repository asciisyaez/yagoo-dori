export type BoardEffectLabelInput = Readonly<{
  kind: string | null;
  trigger: string | null;
  parameter: "performance" | "technique" | "sense" | "all" | null;
  flatValue: number | null;
  valuePermil: number | null;
  valueClass: "flat" | "permil" | "unquantified" | "connector" | "inactive" | "out-of-scope";
  appliesWhen: "always" | "while-leading" | null;
}>;

type BoardEffectLabelTemplate = (effect: BoardEffectLabelInput) => string;

const PARAMETER_LABELS: Readonly<Record<NonNullable<BoardEffectLabelInput["parameter"]>, string>> = {
  performance: "performance",
  technique: "technique",
  sense: "sense",
  all: "all parameters",
};

function prefix(effect: BoardEffectLabelInput): string {
  return effect.appliesWhen === "while-leading" || effect.trigger === "set-live-leader" ? "While leading: " : "";
}

function parameter(effect: BoardEffectLabelInput): string {
  return effect.parameter === null ? "parameters" : PARAMETER_LABELS[effect.parameter];
}

function flatAmount(effect: BoardEffectLabelInput): string {
  return effect.flatValue === null ? "" : ` +${effect.flatValue} (flat)`;
}

function permilAmount(effect: BoardEffectLabelInput): string {
  return effect.valuePermil === null ? "" : ` +${effect.valuePermil} per 1000`;
}

const NEUTRAL_TEMPLATE: BoardEffectLabelTemplate = () => "Not evaluated in suggestions.";

export const BOARD_EFFECT_LABEL_TEMPLATES: Readonly<Record<string, BoardEffectLabelTemplate>> = Object.freeze({
  "performance-up": (effect) => `${prefix(effect)}${parameter(effect)}${flatAmount(effect)}`,
  "technique-up": (effect) => `${prefix(effect)}${parameter(effect)}${flatAmount(effect)}`,
  "sense-up": (effect) => `${prefix(effect)}${parameter(effect)}${flatAmount(effect)}`,
  "all-parameter-up": (effect) => `${prefix(effect)}${parameter(effect)}${flatAmount(effect)}`,
  "performance-up-permil-up": (effect) => `${prefix(effect)}${parameter(effect)}${permilAmount(effect)}`,
  "technique-up-permil-up": (effect) => `${prefix(effect)}${parameter(effect)}${permilAmount(effect)}`,
  "sense-up-permil-up": (effect) => `${prefix(effect)}${parameter(effect)}${permilAmount(effect)}`,
  "all-parameter-up-permil-up": (effect) => `${prefix(effect)}${parameter(effect)}${permilAmount(effect)}`,
  "all-parameter-up-for-character-grouping": NEUTRAL_TEMPLATE,
  "life-up": NEUTRAL_TEMPLATE,
  "live-active-skill-activation-probability-up-permil-up": NEUTRAL_TEMPLATE,
  "live-active-skill-cool-time-shorten-permil-up": NEUTRAL_TEMPLATE,
  "live-active-skill-effect-up-permil-up": NEUTRAL_TEMPLATE,
  "live-deck-leader-active-skill-addition": NEUTRAL_TEMPLATE,
  "live-deck-leader-active-skill-level-up": NEUTRAL_TEMPLATE,
  "live-reward-card-exp-quantity-up-permil-up": NEUTRAL_TEMPLATE,
  "live-reward-quantity-up-permil-up": NEUTRAL_TEMPLATE,
  "live-score-bonus-add-permil-up-by-music-skill-tree-character-and-music-singer-type": NEUTRAL_TEMPLATE,
  "mini-game-reward-quantity-up-permil-up": NEUTRAL_TEMPLATE,
  "work-reward-quantity-up-permil-up": NEUTRAL_TEMPLATE,
});

export function boardEffectLabel(effect: BoardEffectLabelInput): string {
  if (effect.valueClass === "out-of-scope" || effect.valueClass === "unquantified" || effect.valueClass === "inactive" || effect.valueClass === "connector") {
    return NEUTRAL_TEMPLATE(effect);
  }
  const template = effect.kind === null ? undefined : BOARD_EFFECT_LABEL_TEMPLATES[effect.kind];
  return template ? template(effect) : `Board effect ${effect.kind ?? "unknown"} is not evaluated in suggestions.`;
}

export const formatBoardEffectLabel = boardEffectLabel;
