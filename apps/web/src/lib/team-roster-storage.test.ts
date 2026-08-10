import { describe, expect, it } from "vitest";

import {
  TEAM_ROSTER_STORAGE_KEY,
  dismissRosterBackupNotice,
  emptyTeamRoster,
  loadRosterBackup,
  loadTeamRoster,
  restoreRosterBackup,
  saveTeamRoster,
  saveTeamRosterBoardFields,
  saveTeamRosterCalculatorFields,
} from "./team-roster-storage";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
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
      boardPrunes: { nodes: 0, placements: 0, talents: 0 },
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
        version: 4,
        rosterCommit: "new-commit",
        cards: { "card-one": 2 },
        oshi: { enabled: false, talentId: null, role: "member" },
        requiredMemberCardIds: [],
        playerLevel: null,
        boards: {},
      },
      needsWrite: true,
      boardPrunes: { nodes: 0, placements: 0, talents: 0 },
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
        version: 4,
        rosterCommit: "commit-a",
        cards: { "card-one": 3 },
        oshi: { enabled: false, talentId: null, role: "member" },
        requiredMemberCardIds: [],
        playerLevel: null,
        boards: {},
      },
      needsWrite: true,
      boardPrunes: { nodes: 0, placements: 0, talents: 0 },
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
    expect(loaded.roster.version).toBe(4);
    expect(loaded.roster.requiredMemberCardIds).toEqual([
      "card-five",
      "card-four",
      "card-one",
      "card-six",
      "card-three",
    ].sort());
    expect(loaded.needsWrite).toBe(true);
    expect(loaded.boardPrunes).toEqual({ nodes: 0, placements: 0, talents: 0 });
  });

  it("migrates v3 to v4 without inventing Board state", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        rosterCommit: "commit-a",
        cards: { "card-one": 2 },
        requiredMemberCardIds: ["card-one"],
      }),
    );

    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one"]))).toEqual({
      roster: {
        version: 4,
        rosterCommit: "commit-a",
        cards: { "card-one": 2 },
        oshi: { enabled: false, talentId: null, role: "member" },
        requiredMemberCardIds: ["card-one"],
        playerLevel: null,
        boards: {},
      },
      needsWrite: true,
      boardPrunes: { nodes: 0, placements: 0, talents: 0 },
    });
  });

  it("keeps boards across roster commits and reports field-level catalog pruning", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        rosterCommit: "old-commit",
        cards: { "card-keep": 1 },
        oshi: { enabled: false, talentId: null, role: "member" },
        requiredMemberCardIds: [],
        playerLevel: 12,
        boardAssumptions: { unitConnectExclusive: false },
        boards: {
          "talent-keep": {
            rank: 10,
            pointMode: "direct",
            extraPoints: 4,
            directPoints: 9,
            unlockedNodeGroupIds: ["S-001", "G-keep", "G-removed"],
            connectPlacements: {
              "S-001": "card-keep",
              "S-002": "removed-card",
              "S-099": "card-keep",
            },
          },
          "talent-removed": {
            rank: 4,
            pointMode: "estimate-from-rank",
            extraPoints: 0,
            directPoints: null,
            unlockedNodeGroupIds: [],
            connectPlacements: {},
          },
        },
      }),
    );

    const loaded = loadTeamRoster(storage, "new-commit", new Set(["card-keep"]), {
      validTalentIds: new Set(["talent-keep"]),
      validBoardNodeGroupIds: new Set(["S-001", "G-keep"]),
    });

    expect(loaded.roster.rosterCommit).toBe("new-commit");
    expect(loaded.roster.playerLevel).toBe(12);
    expect(loaded.roster.boards).toEqual({
      "talent-keep": {
        rank: 10,
        pointMode: "direct",
        extraPoints: 4,
        directPoints: 9,
        unlockedNodeGroupIds: ["S-001", "G-keep"],
        connectPlacements: { "S-001": "card-keep" },
      },
    });
    expect(loaded.boardPrunes).toEqual({ nodes: 1, placements: 2, talents: 1 });
    expect(loaded.needsWrite).toBe(true);
  });

  it("captures a raw pre-migration backup when pruning occurs and keeps it across later writes", () => {
    const storage = new MemoryStorage();
    const rawRecord = JSON.stringify({
      version: 4,
      rosterCommit: "old-commit",
      cards: { "card-keep": 1 },
      oshi: { enabled: false, talentId: null, role: "member" },
      requiredMemberCardIds: [],
      playerLevel: 12,
      boards: {
        "talent-keep": {
          rank: 10,
          pointMode: "estimate-from-rank",
          extraPoints: 0,
          directPoints: null,
          unlockedNodeGroupIds: ["S-001", "G-removed"],
          connectPlacements: {},
        },
        "talent-removed": {
          rank: 4,
          pointMode: "estimate-from-rank",
          extraPoints: 0,
          directPoints: null,
          unlockedNodeGroupIds: [],
          connectPlacements: {},
        },
      },
    });
    storage.setItem(TEAM_ROSTER_STORAGE_KEY, rawRecord);
    const catalogs = {
      validTalentIds: new Set(["talent-keep"]),
      validBoardNodeGroupIds: new Set(["S-001"]),
    };

    const loaded = loadTeamRoster(storage, "new-commit", new Set(["card-keep"]), catalogs);
    expect(loaded.boardPrunes).toEqual({ nodes: 1, placements: 0, talents: 1 });
    expect(loaded.backupReady).toBe(true);

    const backup = loadRosterBackup(storage);
    expect(backup).not.toBeNull();
    expect(backup!.version).toBe(4);
    expect(backup!.raw).toBe(rawRecord);
    expect(backup!.dismissed).toBe(false);
    expect(backup!.boardPrunes).toEqual({ nodes: 1, placements: 0, talents: 1 });
    expect(backup!.prunedTalentIds).toEqual(["talent-removed"]);

    // The planner's sanitized rewrite must not clobber the captured backup.
    saveTeamRosterBoardFields(storage, {
      rosterCommit: "new-commit",
      playerLevel: loaded.roster.playerLevel,
      boards: loaded.roster.boards,
    });
    const reloaded = loadTeamRoster(storage, "new-commit", new Set(["card-keep"]), catalogs);
    expect(reloaded.boardPrunes).toEqual({ nodes: 0, placements: 0, talents: 0 });
    expect(loadRosterBackup(storage)!.raw).toBe(rawRecord);
  });

  it("restores the raw backup and can dismiss the migration notice without deleting it", () => {
    const storage = new MemoryStorage();
    const rawRecord = JSON.stringify({
      version: 4,
      rosterCommit: "old-commit",
      cards: { "card-keep": 1 },
      oshi: { enabled: false, talentId: null, role: "member" },
      requiredMemberCardIds: [],
      playerLevel: null,
      boards: {
        "talent-removed": {
          rank: 4,
          pointMode: "estimate-from-rank",
          extraPoints: 0,
          directPoints: null,
          unlockedNodeGroupIds: [],
          connectPlacements: {},
        },
      },
    });
    storage.setItem(TEAM_ROSTER_STORAGE_KEY, rawRecord);
    const catalogs = {
      validTalentIds: new Set(["talent-keep"]),
      validBoardNodeGroupIds: new Set(["S-001"]),
    };

    const loaded = loadTeamRoster(storage, "new-commit", new Set(["card-keep"]), catalogs);
    expect(loaded.backupReady).toBe(true);

    // Simulate the sanitized rewrite, then restore: the main key holds the
    // raw record again and the load result reports the same pruning.
    saveTeamRosterBoardFields(storage, { rosterCommit: "new-commit", playerLevel: null, boards: loaded.roster.boards });
    const restored = restoreRosterBackup(storage, "new-commit", new Set(["card-keep"]), catalogs);
    expect(restored).not.toBeNull();
    expect(restored!.boardPrunes).toEqual({ nodes: 0, placements: 0, talents: 1 });
    expect(storage.getItem(TEAM_ROSTER_STORAGE_KEY)).toBe(rawRecord);

    dismissRosterBackupNotice(storage);
    const backup = loadRosterBackup(storage);
    expect(backup).not.toBeNull();
    expect(backup!.dismissed).toBe(true);
    expect(backup!.raw).toBe(rawRecord);
  });

  it("preserves persisted Board state when the calculator autosaves its own fields", () => {
    const storage = new MemoryStorage();
    const board = {
      rank: 12,
      pointMode: "estimate-from-rank" as const,
      extraPoints: 3,
      directPoints: null,
      unlockedNodeGroupIds: ["B-001"],
      connectPlacements: { "S-001": "card-one" },
    };
    saveTeamRoster(storage, {
      ...emptyTeamRoster("commit-a"),
      cards: { "card-one": 2 },
      playerLevel: 12,
      boards: { "talent-a": board },
    });

    // The calculator-owned write must not touch playerLevel/boards.
    saveTeamRosterCalculatorFields(storage, {
      rosterCommit: "commit-a",
      cards: { "card-one": 5, "card-two": 0 },
      oshi: { enabled: true, talentId: "talent-a", role: "leader" },
      requiredMemberCardIds: ["card-one"],
    });

    const loaded = loadTeamRoster(storage, "commit-a", new Set(["card-one", "card-two"]));
    expect(loaded.roster.cards).toEqual({ "card-one": 5, "card-two": 0 });
    expect(loaded.roster.oshi).toEqual({ enabled: true, talentId: "talent-a", role: "leader" });
    expect(loaded.roster.playerLevel).toBe(12);
    expect(loaded.roster.boards).toEqual({ "talent-a": board });
  });

  it("preserves calculator fields when the Board planner autosaves its own fields", () => {
    const storage = new MemoryStorage();
    saveTeamRoster(storage, {
      ...emptyTeamRoster("commit-a"),
      cards: { "card-one": 2 },
      oshi: { enabled: true, talentId: "talent-a", role: "member" },
      requiredMemberCardIds: ["card-one"],
    });

    const board = {
      rank: 14,
      pointMode: "direct" as const,
      extraPoints: 0,
      directPoints: 24,
      unlockedNodeGroupIds: ["S-001"],
      connectPlacements: { "S-002": "card-one" },
    };
    saveTeamRosterBoardFields(storage, {
      rosterCommit: "commit-a",
      playerLevel: 18,
      boards: { "talent-a": board },
    });

    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one"])).roster).toEqual({
      ...emptyTeamRoster("commit-a"),
      cards: { "card-one": 2 },
      oshi: { enabled: true, talentId: "talent-a", role: "member" },
      requiredMemberCardIds: ["card-one"],
      playerLevel: 18,
      boards: { "talent-a": board },
    });
  });

  it("preserves readable calculator fields when the planner writes over an unsupported version", () => {
    const storage = new MemoryStorage();
    // A future/foreign version tag must not cost the user their calculator
    // data when the Board planner autosaves.
    storage.setItem(
      TEAM_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        rosterCommit: "commit-a",
        cards: { "card-one": 2 },
        oshi: { enabled: true, talentId: "talent-a", role: "leader" },
        requiredMemberCardIds: ["card-one"],
      }),
    );

    saveTeamRosterBoardFields(storage, {
      rosterCommit: "commit-a",
      playerLevel: 7,
      boards: {},
    });

    const loaded = loadTeamRoster(storage, "commit-a", new Set(["card-one"]));
    expect(loaded.roster.cards).toEqual({ "card-one": 2 });
    expect(loaded.roster.oshi).toEqual({ enabled: true, talentId: "talent-a", role: "leader" });
    expect(loaded.roster.requiredMemberCardIds).toEqual(["card-one"]);
    expect(loaded.roster.playerLevel).toBe(7);
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
      boardPrunes: { nodes: 0, placements: 0, talents: 0 },
    });

    storage.setItem(TEAM_ROSTER_STORAGE_KEY, "not-json");
    expect(loadTeamRoster(storage, "commit-a", new Set(["card-one"]))).toEqual({
      roster: emptyTeamRoster("commit-a"),
      needsWrite: true,
      boardPrunes: { nodes: 0, placements: 0, talents: 0 },
    });
  });
});
