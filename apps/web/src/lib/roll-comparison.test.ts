import { describe, expect, it } from "vitest";
import { selectAcquisitionTeam } from "./roll-comparison";

const team = (central: number, member = "owned", leader = "owned-leader") => ({
  leader: { cardId: leader }, members: [{ cardId: member }], score: { relativeUtility: { central } },
});

describe("optional acquisition comparison", () => {
  const baseline = team(100);
  it("keeps the owned team when a bounded search regresses or ties", () => {
    expect(selectAcquisitionTeam(baseline, team(90, "new"), "new")).toBe(baseline);
    expect(selectAcquisitionTeam(baseline, team(100, "new"), "new")).toBe(baseline);
  });
  it("does not attribute unrelated search improvements to the acquisition", () => {
    expect(selectAcquisitionTeam(baseline, team(120), "new")).toBe(baseline);
  });
  it("recognizes both Member and Leader Outfit upgrades", () => {
    const member = team(120, "new");
    const leader = team(110, "owned", "new");
    expect(selectAcquisitionTeam(baseline, member, "new")).toBe(member);
    expect(selectAcquisitionTeam(baseline, leader, "new")).toBe(leader);
  });
});
