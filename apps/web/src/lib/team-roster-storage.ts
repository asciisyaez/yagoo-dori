export const TEAM_ROSTER_STORAGE_KEY = "yagoo-dori:team-calculator-roster";

export const BLOOM_STAGES = [0, 1, 2, 3, 4, 5] as const;
export const BOARD_CONNECT_SLOTS = ["S-001", "S-002", "S-003", "S-004"] as const;
export const BOARD_POINT_MODES = ["estimate-from-rank", "direct"] as const;

export type BloomStage = (typeof BLOOM_STAGES)[number];
export type BoardConnectSlot = (typeof BOARD_CONNECT_SLOTS)[number];
export type BoardPointMode = (typeof BOARD_POINT_MODES)[number];

export const TEAM_OSHI_ROLES = ["member", "leader", "member-and-leader"] as const;

export type StoredOshiRole = (typeof TEAM_OSHI_ROLES)[number];

export type StoredOshiPreference = {
  enabled: boolean;
  talentId: string | null;
  role: StoredOshiRole;
};

export type StoredTalentBoard = {
  rank: number;
  pointMode: BoardPointMode;
  extraPoints: number;
  directPoints: number | null;
  unlockedNodeGroupIds: string[];
  connectPlacements: Partial<Record<BoardConnectSlot, string>>;
};

export type StoredTeamRoster = {
  version: 4;
  rosterCommit: string;
  cards: Record<string, BloomStage>;
  oshi: StoredOshiPreference;
  requiredMemberCardIds: string[];
  playerLevel: number | null;
  boards: Record<string, StoredTalentBoard>;
};

export type BoardPruneCounts = {
  nodes: number;
  placements: number;
  talents: number;
};

export type TeamRosterCatalogs = {
  validTalentIds: ReadonlySet<string>;
  validBoardNodeGroupIds: ReadonlySet<string>;
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export type LoadedTeamRoster = {
  roster: StoredTeamRoster;
  needsWrite: boolean;
  boardPrunes: BoardPruneCounts;
};

function zeroBoardPrunes(): BoardPruneCounts {
  return { nodes: 0, placements: 0, talents: 0 };
}

function isBloomStage(value: unknown): value is BloomStage {
  return typeof value === "number" && BLOOM_STAGES.includes(value as BloomStage);
}

function isOshiRole(value: unknown): value is StoredOshiRole {
  return typeof value === "string" && TEAM_OSHI_ROLES.includes(value as StoredOshiRole);
}

function isPointMode(value: unknown): value is BoardPointMode {
  return typeof value === "string" && BOARD_POINT_MODES.includes(value as BoardPointMode);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPlayerLevel(value: unknown): value is number | null {
  return value === null || isNonnegativeInteger(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameRecord(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return JSON.stringify(leftKeys) === JSON.stringify(rightKeys) && leftKeys.every((key) => left[key] === right[key]);
}

export function emptyTeamRoster(rosterCommit: string): StoredTeamRoster {
  return {
    version: 4,
    rosterCommit,
    cards: {},
    oshi: { enabled: false, talentId: null, role: "member" },
    requiredMemberCardIds: [],
    playerLevel: null,
    boards: {},
  };
}

function sanitizeBoard(
  candidate: unknown,
  validCardIds: ReadonlySet<string>,
  catalogs: TeamRosterCatalogs | undefined,
  boardPrunes: BoardPruneCounts,
): StoredTalentBoard | null {
  if (!isObject(candidate)) return null;
  const rank = isNonnegativeInteger(candidate.rank) && candidate.rank >= 1 && candidate.rank <= 50 ? candidate.rank : 1;
  const pointMode = isPointMode(candidate.pointMode) ? candidate.pointMode : "estimate-from-rank";
  const extraPoints = isNonnegativeInteger(candidate.extraPoints) ? candidate.extraPoints : 0;
  const directPoints = candidate.directPoints === null || isNonnegativeInteger(candidate.directPoints)
    ? candidate.directPoints as number | null
    : null;

  const unlockedNodeGroupIds: string[] = [];
  const seenGroups = new Set<string>();
  if (Array.isArray(candidate.unlockedNodeGroupIds)) {
    for (const groupId of candidate.unlockedNodeGroupIds) {
      if (typeof groupId !== "string" || seenGroups.has(groupId)) continue;
      seenGroups.add(groupId);
      if (catalogs && !catalogs.validBoardNodeGroupIds.has(groupId)) {
        boardPrunes.nodes += 1;
        continue;
      }
      unlockedNodeGroupIds.push(groupId);
    }
  }

  const connectPlacements: Partial<Record<BoardConnectSlot, string>> = {};
  if (isObject(candidate.connectPlacements)) {
    for (const [slot, cardId] of Object.entries(candidate.connectPlacements)) {
      if (!(BOARD_CONNECT_SLOTS as readonly string[]).includes(slot) || typeof cardId !== "string" || !validCardIds.has(cardId)) {
        boardPrunes.placements += 1;
        continue;
      }
      connectPlacements[slot as BoardConnectSlot] = cardId;
    }
  }

  return { rank, pointMode, extraPoints, directPoints, unlockedNodeGroupIds, connectPlacements };
}

export function loadTeamRoster(
  storage: StorageReader,
  rosterCommit: string,
  validCardIds: ReadonlySet<string>,
  catalogs?: TeamRosterCatalogs,
): LoadedTeamRoster {
  const empty = emptyTeamRoster(rosterCommit);
  const boardPrunes = zeroBoardPrunes();
  const raw = storage.getItem(TEAM_ROSTER_STORAGE_KEY);
  if (!raw) return { roster: empty, needsWrite: false, boardPrunes };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { roster: empty, needsWrite: true, boardPrunes };
  }

  if (!isObject(parsed)) return { roster: empty, needsWrite: true, boardPrunes };

  const candidate = parsed as {
    version?: unknown;
    rosterCommit?: unknown;
    cards?: unknown;
    oshi?: unknown;
    requiredMemberCardIds?: unknown;
    playerLevel?: unknown;
    boards?: unknown;
    boardAssumptions?: unknown;
  };
  if (
    (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3 && candidate.version !== 4) ||
    !isObject(candidate.cards)
  ) {
    return { roster: empty, needsWrite: true, boardPrunes };
  }

  const cards: Record<string, BloomStage> = {};
  for (const [cardId, bloomStage] of Object.entries(candidate.cards)) {
    if (validCardIds.has(cardId) && isBloomStage(bloomStage)) cards[cardId] = bloomStage;
  }

  const candidateOshi = isObject(candidate.oshi) ? candidate.oshi : null;
  const oshi: StoredOshiPreference = (candidate.version === 2 || candidate.version === 3 || candidate.version === 4) && candidateOshi
    ? {
        enabled: candidateOshi.enabled === true,
        talentId:
          typeof candidateOshi.talentId === "string" && candidateOshi.talentId.length > 0
            ? candidateOshi.talentId
            : null,
        role: isOshiRole(candidateOshi.role) ? candidateOshi.role : "member",
      }
    : empty.oshi;

  const requiredMemberCardIds = candidate.version === 3 || candidate.version === 4
    ? Array.isArray(candidate.requiredMemberCardIds)
      ? [...new Set(candidate.requiredMemberCardIds.filter(
        (cardId): cardId is string => typeof cardId === "string" && validCardIds.has(cardId) && cardId in cards,
      ))].sort().slice(0, 5)
      : []
    : [];

  const playerLevel = candidate.version === 4 && isPlayerLevel(candidate.playerLevel) ? candidate.playerLevel : null;
  const boards: Record<string, StoredTalentBoard> = {};
  if (candidate.version === 4 && isObject(candidate.boards)) {
    for (const [talentId, rawBoard] of Object.entries(candidate.boards)) {
      if (catalogs && !catalogs.validTalentIds.has(talentId)) {
        boardPrunes.talents += 1;
        continue;
      }
      const board = sanitizeBoard(rawBoard, validCardIds, catalogs, boardPrunes);
      if (board) boards[talentId] = board;
      else boardPrunes.talents += 1;
    }
  }

  const roster: StoredTeamRoster = {
    version: 4,
    rosterCommit,
    cards,
    oshi,
    requiredMemberCardIds,
    playerLevel,
    boards,
  };
  const rawBoards = candidate.version === 4 && isObject(candidate.boards) ? candidate.boards : {};
  const rawPlayerLevel = candidate.version === 4 ? candidate.playerLevel : undefined;
  const needsWrite =
    candidate.version !== 4 ||
    candidate.rosterCommit !== rosterCommit ||
    !sameRecord(candidate.cards, cards) ||
    !candidateOshi ||
    candidateOshi.enabled !== oshi.enabled ||
    candidateOshi.talentId !== oshi.talentId ||
    candidateOshi.role !== oshi.role ||
    !Array.isArray(candidate.requiredMemberCardIds) ||
    JSON.stringify(candidate.requiredMemberCardIds) !== JSON.stringify(requiredMemberCardIds) ||
    rawPlayerLevel !== playerLevel ||
    JSON.stringify(rawBoards) !== JSON.stringify(boards) ||
    Object.prototype.hasOwnProperty.call(candidate, "boardAssumptions");
  return { roster, needsWrite, boardPrunes };
}

export function saveTeamRoster(storage: StorageWriter, roster: StoredTeamRoster): void {
  storage.setItem(TEAM_ROSTER_STORAGE_KEY, JSON.stringify(roster));
}

export type CalculatorOwnedRosterFields = {
  rosterCommit: string;
  cards: Record<string, BloomStage>;
  oshi: StoredOshiPreference;
  requiredMemberCardIds: string[];
};

// The Board planner owns playerLevel/boards; the team calculator owns the
// rest. Carry the stored Board fields verbatim (load-time sanitization guards
// consumers) so a calculator autosave can never erase persisted Board state.
function readPreservedBoardFields(
  storage: StorageReader,
): Pick<StoredTeamRoster, "playerLevel" | "boards"> {
  const preserved: Pick<StoredTeamRoster, "playerLevel" | "boards"> = { playerLevel: null, boards: {} };
  const raw = storage.getItem(TEAM_ROSTER_STORAGE_KEY);
  if (!raw) return preserved;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return preserved;
  }
  if (!isObject(parsed)) return preserved;
  if (isPlayerLevel(parsed.playerLevel)) preserved.playerLevel = parsed.playerLevel;
  if (isObject(parsed.boards)) {
    for (const [talentId, board] of Object.entries(parsed.boards)) {
      if (isObject(board)) preserved.boards[talentId] = board as unknown as StoredTalentBoard;
    }
  }
  return preserved;
}

export function saveTeamRosterCalculatorFields(
  storage: StorageReader & StorageWriter,
  fields: CalculatorOwnedRosterFields,
): void {
  saveTeamRoster(storage, {
    ...emptyTeamRoster(fields.rosterCommit),
    ...readPreservedBoardFields(storage),
    cards: fields.cards,
    oshi: fields.oshi,
    requiredMemberCardIds: fields.requiredMemberCardIds,
  });
}
