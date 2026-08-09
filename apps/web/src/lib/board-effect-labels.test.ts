import { describe, expect, it } from "vitest";

import { mechanicsData } from "@yagoo-dori/core/mechanics";

import {
  BOARD_EFFECT_LABEL_TEMPLATES,
  boardEffectLabel,
  type BoardEffectLabelInput,
} from "./board-effect-labels";

const GATED_WORDS = ["best", "optimal", "exact", "exhaustive", "global", "certified", "certificate", "proof", "proven", "score"];

function effectForKind(kind: string): BoardEffectLabelInput {
  const catalogEffect = mechanicsData.catalogs.boardEffects.find((effect) => effect.kind === kind);
  const isPermil = kind.endsWith("-permil-up");
  return {
    kind,
    trigger: catalogEffect?.characterTrigger ?? "always",
    parameter: kind.startsWith("performance-")
      ? "performance"
      : kind.startsWith("technique-")
        ? "technique"
        : kind.startsWith("sense-")
          ? "sense"
          : kind.startsWith("all-parameter-")
            ? "all"
            : null,
    flatValue: isPermil ? null : catalogEffect?.value ?? null,
    valuePermil: isPermil ? catalogEffect?.value ?? null : null,
    valueClass: ["performance-up", "technique-up", "sense-up", "all-parameter-up"].includes(kind)
      ? "flat"
      : ["performance-up-permil-up", "technique-up-permil-up", "sense-up-permil-up", "all-parameter-up-permil-up"].includes(kind)
        ? "permil"
        : "unquantified",
    appliesWhen: catalogEffect?.characterTrigger === "set-live-leader" ? "while-leading" : "always",
  };
}

describe("Board effect labels", () => {
  it("labels every catalog effect kind without passing through upstream prose", () => {
    const kinds = [...new Set(mechanicsData.catalogs.boardEffects.map((effect) => effect.kind))];
    for (const kind of kinds) {
      expect(boardEffectLabel(effectForKind(kind))).toBeTruthy();
    }
  });

  it("keeps every template value free of gated copy-audit words", () => {
    for (const template of Object.values(BOARD_EFFECT_LABEL_TEMPLATES)) {
      const rendered = template(effectForKind("performance-up")).toLowerCase();
      for (const word of GATED_WORDS) expect(rendered).not.toContain(word);
    }
  });

  it("uses neutral and deterministic fallbacks", () => {
    expect(boardEffectLabel({ ...effectForKind("life-up"), valueClass: "out-of-scope" })).toBe("Not evaluated in suggestions.");
    expect(boardEffectLabel({ ...effectForKind("future-effect-kind"), valueClass: "flat" })).toBe(
      "Board effect future-effect-kind is not evaluated in suggestions.",
    );
  });
});
