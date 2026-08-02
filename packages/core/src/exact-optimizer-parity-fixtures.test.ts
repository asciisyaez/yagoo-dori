import { describe, expect, it } from "vitest";

import { mechanicsData } from "./mechanics";
import {
  assertLegalFormation,
  evaluateTrigger,
  resolveTargetRecipients,
  type FormationInput,
} from "./formation-evaluator";

const fixtureFormation: FormationInput = {
  leaderOutfitCardId: "card-00011-5-uniq-0011-00",
  members: [
    "card-00013-5-uniq-0002-00",
    "card-00018-5-uniq-0004-00",
    "card-00002-5-uniq-0001-00",
    "card-00015-5-uniq-0003-00",
    "card-00001-5-uniq-0000-00",
  ].map((cardId) => ({ cardId, investment: "one-copy-maximum" as const })),
};

const legal = assertLegalFormation(fixtureFormation);
const triggerRows = mechanicsData.cards.flatMap((card) =>
  [...card.skills.active, ...card.skills.passive, ...card.skills.special, { applications: card.leaderOutfit.applications }]
    .flatMap((skill) => skill.applications)
    .flatMap((application) => (application.trigger ? [application.trigger] : [])),
);

describe("compiled-kernel parity mechanic fixtures", () => {
  it("exercises every observed trigger family in passing and failing states", () => {
    const byKind = new Map(triggerRows.map((trigger) => [trigger.kind, trigger]));
    expect([...byKind.keys()].sort()).toEqual([
      "combo-at-least",
      "deck-attribute-count",
      "deck-character-group-count",
      "life-at-least",
    ]);

    const combo = byKind.get("combo-at-least");
    if (combo) {
      expect(evaluateTrigger(combo, legal, { combo: combo.threshold ?? 0 })).toBe(true);
      expect(evaluateTrigger(combo, legal, { combo: Math.max(0, (combo.threshold ?? 0) - 1) })).toBe(false);
    }
    const life = byKind.get("life-at-least");
    if (life) {
      expect(evaluateTrigger(life, legal, { life: life.threshold ?? 0 })).toBe(true);
      expect(evaluateTrigger(life, legal, { life: Math.max(0, (life.threshold ?? 0) - 1) })).toBe(false);
    }

    for (const kind of ["deck-attribute-count", "deck-character-group-count"] as const) {
      const trigger = byKind.get(kind);
      if (!trigger) continue;
      const count = legal.members.filter((member) =>
        kind === "deck-attribute-count"
          ? member.publicCard.attribute === trigger.attribute
          : member.publicCard.groups.some((group) =>
              group.toLowerCase().replace(/[^a-z0-9]/g, "") ===
              trigger.characterGroupingId?.replace(/^grp-/, "").toLowerCase().replace(/[^a-z0-9]/g, ""),
            ),
      ).length;
      // The formation itself supplies the real deck state; use threshold and
      // threshold+one to force both resolver branches without changing it.
      const passTrigger = { ...trigger, threshold: Math.min(trigger.threshold ?? 0, count) };
      const failTrigger = { ...trigger, threshold: count + 1 };
      expect(evaluateTrigger(passTrigger, legal, { combo: 1_000, life: 1_000 })).toBe(true);
      expect(evaluateTrigger(failTrigger, legal, { combo: 1_000, life: 1_000 })).toBe(false);
    }

  });

  it("exercises every target selector and the capped-recipient interval", () => {
    const applications = mechanicsData.cards.flatMap((card) =>
      [...card.skills.active, ...card.skills.passive, ...card.skills.special, { applications: card.leaderOutfit.applications }]
        .flatMap((skill) => skill.applications),
    );
    const targets = new Map(
      applications.flatMap((application) => (application.target ? [[application.target.kind, application.target]] : [])),
    );
    expect([...targets.keys()].sort()).toEqual(["all", "attribute", "character-group", "self"]);

    for (const target of targets.values()) {
      const resolution = resolveTargetRecipients(target, legal.members, 0);
      expect(resolution.alternatives.length).toBeGreaterThan(0);
      expect(resolution.recipientCount.minimum).toBeLessThanOrEqual(resolution.recipientCount.maximum);
    }

    const capped = applications
      .map((application) => application.target)
      .filter((target): target is NonNullable<typeof target> => target?.count !== null && target?.count !== undefined)
      .find((target) => resolveTargetRecipients(target, legal.members, 0).alternatives.length > 1);
    expect(capped).toBeDefined();
    const cappedResolution = resolveTargetRecipients(capped!, legal.members, 0);
    expect(cappedResolution.recipientCount.minimum).toBe(capped!.count);
    expect(cappedResolution.recipientCount.maximum).toBe(capped!.count);
    expect(cappedResolution.status).toBe("enumerated");
  });
});
