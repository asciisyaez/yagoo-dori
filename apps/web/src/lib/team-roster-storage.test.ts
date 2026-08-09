import { describe, expect, it } from "vitest";

import {
  TEAM_ROSTER_STORAGE_KEY,
  emptyTeamRoster,
  loadTeamRoster,
  saveTeamRoster,
} from "./team-roster-storage";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("team calculator roster persistence", () => {
  it("round-trips exact card IDs, independent Bloom stages, and Oshi preferences", () => {
    const storage = new MemoryStorage();
    const roster = {
      ...emptyTeamRoster("commit-a"),
      cards: { "card-one": 0 as const, "card-two": 5 as const },
      oshi: { enabled: true, talentId: "talent-one", role: "member-and-leader" as const },
      requiredMemberCardIds: ["card-two"],
    };

    saveTeamRoster(storage, roster);

    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one", "card-two"]))).toEqual({
      roster,
      needsWrite: false,
    });
  });

  it("migrates a saved roster to a new commit and drops stale card IDs", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        rosterCommit: "old-commit",
        cards: { "card-one": 2, "removed-card": 4 },
      }),
    );

    expect(loadTeamRoster(storage, "new-commit", new Set(["card-one"]))).toEqual({
      roster: {
        version: 3,
        rosterCommit: "new-commit",
        cards: { "card-one": 2 },
        oshi: { enabled: false, talentId: null, role: "member" },
        requiredMemberCardIds: [],
      },
      needsWrite: true,
    });
  });

  it("sanitizes malformed Oshi preferences without dropping valid cards", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        rosterCommit: "commit-a",
        cards: { "card-one": 3 },
        oshi: { enabled: "yes", talentId: "", role: "outfit" },
      }),
    );

    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one"]))).toEqual({
      roster: {
        version: 3,
        rosterCommit: "commit-a",
        cards: { "card-one": 3 },
        oshi: { enabled: false, talentId: null, role: "member" },
        requiredMemberCardIds: [],
      },
      needsWrite: true,
    });
  });

  it("migrates v2 without locks and sanitizes v3 locks to selected owned cards", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        rosterCommit: "commit-a",
        cards: {
          "card-one": 0,
          "card-two": 1,
          "card-three": 2,
          "card-four": 3,
          "card-five": 4,
          "card-six": 5,
        },
        requiredMemberCardIds: [
          "card-six",
          "removed-card",
          "card-one",
          "card-six",
          "card-five",
          "card-four",
          "card-three",
        ],
      }),
    );

    const loaded = loadTeamRoster(
      storage,
      "commit-a",
      new Set(["card-one", "card-two", "card-three", "card-four", "card-five", "card-six"]),
    );
    expect(loaded.roster.version).toBe(3);
    expect(loaded.roster.requiredMemberCardIds).toEqual([
      "card-five",
      "card-four",
      "card-one",
      "card-six",
      "card-three",
    ].sort());
    expect(loaded.needsWrite).toBe(true);
  });

  it("recovers from malformed versions and invalid Bloom values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({ version: 1, rosterCommit: "commit-a", cards: { "card-one": 7 } }),
    );
    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one"]))).toEqual({
      roster: emptyTeamRoster("commit-a"),
      needsWrite: true,
    });

    storage.setItem(TEAM_ROSTER_STORAGE_KEY, "not-json");
    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one"]))).toEqual({
      roster: emptyTeamRoster("commit-a"),
      needsWrite: true,
    });
  });
});
