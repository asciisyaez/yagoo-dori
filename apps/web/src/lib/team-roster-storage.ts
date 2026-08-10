export const TEAM_ROSTER_STORAGE_KEY = "yagoo-dori:team-calculator-roster";
export const TEAM_ROSTER_BACKUP_KEY_PREFIX = `${TEAM_ROSTER_STORAGE_KEY}:backup-v`;
export const TEAM_ROSTER_BACKUP_METADATA_KEY = `${TEAM_ROSTER_STORAGE_KEY}:backup-metadata`;

export const BLOOM_STAGES = [0, 1, 2, 3, 4, 5] as const;
export const BOARD_CONNECT_SLOTS = ["S-001", "S-002", "S-003", "S-004"] as const;
export const BOARD_POINT_MODES = ["estimate-from-rank", "direct"] as const;
const STORED_ROSTER_VERSIONS = [1, 2, 3, 4] as const;

export type BloomStage = (typeof BLOOM_STAGES)[number];
export type BoardConnectSlot = (typeof BOARD_CONNECT_SLOTS)[number];
export type BoardPointMode = (typeof BOARD_POINT_MODES)[number];
export type RosterBackupVersion = (typeof STORED_ROSTER_VERSIONS)[number];

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
type StorageRemover = Pick<Storage, "removeItem">;
type StorageStore = StorageReader & StorageWriter & Partial<StorageRemover>;

export type LoadedTeamRoster = {
  roster: StoredTeamRoster;
  needsWrite: boolean;
  boardPrunes: BoardPruneCounts;
  backupReady?: boolean;
};

export type RosterBackup = Readonly<{
  key: string;
  version: RosterBackupVersion;
  raw: string;
  dismissed: boolean;
  boardPrunes: BoardPruneCounts;
  prunedTalentIds: string[];
}>;

type RosterBackupMetadata = Omit<RosterBackup, "raw">;

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

function isRosterBackupVersion(value: unknown): value is RosterBackupVersion {
  return typeof value === "number" && STORED_ROSTER_VERSIONS.includes(value as RosterBackupVersion);
}

function backupKey(version: RosterBackupVersion): string {
  return `${TEAM_ROSTER_BACKUP_KEY_PREFIX}${version}`;
}

function normalizedTalentIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((talentId): talentId is string => typeof talentId === "string"))].sort()
    : [];
}

function normalizedBoardPrunes(value: unknown): BoardPruneCounts | null {
  if (value === undefined) return zeroBoardPrunes();
  if (!isObject(value) || !isNonnegativeInteger(value.nodes) || !isNonnegativeInteger(value.placements) || !isNonnegativeInteger(value.talents)) {
    return null;
  }
  return { nodes: value.nodes, placements: value.placements, talents: value.talents };
}

function sameBoardPrunes(left: BoardPruneCounts, right: BoardPruneCounts): boolean {
  return left.nodes === right.nodes && left.placements === right.placements && left.talents === right.talents;
}

function readBackupMetadata(storage: StorageReader): RosterBackupMetadata | null {
  const raw = storage.getItem(TEAM_ROSTER_BACKUP_METADATA_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const boardPrunes = isObject(parsed) ? normalizedBoardPrunes(parsed.boardPrunes) : null;
  if (!isObject(parsed) || !isRosterBackupVersion(parsed.version) || parsed.key !== backupKey(parsed.version) || typeof parsed.dismissed !== "boolean" || !boardPrunes) {
    return null;
  }
  return {
    key: parsed.key,
    version: parsed.version,
    dismissed: parsed.dismissed,
    boardPrunes,
    prunedTalentIds: normalizedTalentIds(parsed.prunedTalentIds),
  };
}

function rawBackup(storage: StorageReader, version: RosterBackupVersion): string | null {
  const raw = storage.getItem(backupKey(version));
  return raw && raw.length > 0 ? raw : null;
}

export function loadRosterBackup(storage: StorageReader): RosterBackup | null {
  let selected: { key: string; version: RosterBackupVersion; raw: string } | null = null;
  for (const version of [...STORED_ROSTER_VERSIONS].reverse()) {
    const raw = rawBackup(storage, version);
    if (raw) {
      selected = { key: backupKey(version), version, raw };
      break;
    }
  }
  if (!selected) return null;

  const metadata = readBackupMetadata(storage);
  if (metadata?.key === selected.key) return { ...metadata, raw: selected.raw };
  return {
    ...selected,
    dismissed: false,
    boardPrunes: zeroBoardPrunes(),
    prunedTalentIds: [],
  };
}

function backupMatchesCurrent(
  storage: StorageReader,
  raw: string,
  version: RosterBackupVersion,
  boardPrunes: BoardPruneCounts,
  prunedTalentIds: readonly string[],
): boolean {
  try {
    const backup = loadRosterBackup(storage);
    return backup !== null
      && backup.version === version
      && backup.raw === raw
      && sameBoardPrunes(backup.boardPrunes, boardPrunes)
      && JSON.stringify(backup.prunedTalentIds) === JSON.stringify(normalizedTalentIds(prunedTalentIds));
  } catch {
    return false;
  }
}

function captureRosterBackup(
  storage: StorageReader,
  raw: string,
  version: RosterBackupVersion,
  boardPrunes: BoardPruneCounts,
  prunedTalentIds: readonly string[],
): boolean {
  const store = storage as StorageStore;
  if (typeof store.setItem !== "function") return false;

  try {
    const existing = loadRosterBackup(storage);
    const candidateTalentIds = normalizedTalentIds(prunedTalentIds);
    const sameFlow = existing && existing.version === version
      && existing.raw === raw
      && sameBoardPrunes(existing.boardPrunes, boardPrunes)
      && JSON.stringify(existing.prunedTalentIds) === JSON.stringify(candidateTalentIds);
    if (existing && (existing.version > version || sameFlow)) {
      if (!readBackupMetadata(storage)) {
        store.setItem(TEAM_ROSTER_BACKUP_METADATA_KEY, JSON.stringify({
          key: existing.key,
          version: existing.version,
          dismissed: existing.dismissed,
          boardPrunes: existing.boardPrunes,
          prunedTalentIds: existing.prunedTalentIds,
        }));
      }
      return backupMatchesCurrent(storage, raw, version, boardPrunes, candidateTalentIds);
    }

    const key = backupKey(version);
    store.setItem(key, raw);
    store.setItem(TEAM_ROSTER_BACKUP_METADATA_KEY, JSON.stringify({
      key,
      version,
      dismissed: false,
      boardPrunes,
      prunedTalentIds: candidateTalentIds,
    }));
    if (typeof store.removeItem === "function") {
      for (const otherVersion of STORED_ROSTER_VERSIONS) {
        if (otherVersion !== version) store.removeItem(backupKey(otherVersion));
      }
    }
  } catch {
    // A storage quota or privacy failure must not make the planner unusable.
  }
  return backupMatchesCurrent(storage, raw, version, boardPrunes, prunedTalentIds);
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
    !isRosterBackupVersion(candidate.version) ||
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
  const prunedTalentIds: string[] = [];
  if (candidate.version === 4 && isObject(candidate.boards)) {
    for (const [talentId, rawBoard] of Object.entries(candidate.boards)) {
      if (catalogs && !catalogs.validTalentIds.has(talentId)) {
        boardPrunes.talents += 1;
        prunedTalentIds.push(talentId);
        continue;
      }
      const board = sanitizeBoard(rawBoard, validCardIds, catalogs, boardPrunes);
      if (board) boards[talentId] = board;
      else {
        boardPrunes.talents += 1;
        prunedTalentIds.push(talentId);
      }
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
  if (boardPrunes.nodes > 0 || boardPrunes.placements > 0 || boardPrunes.talents > 0) {
    return {
      roster,
      needsWrite,
      boardPrunes,
      backupReady: captureRosterBackup(storage, raw, candidate.version, boardPrunes, prunedTalentIds),
    };
  }
  return { roster, needsWrite, boardPrunes };
}

export function dismissRosterBackupNotice(storage: StorageReader & StorageWriter): void {
  const backup = loadRosterBackup(storage);
  if (!backup) return;
  storage.setItem(TEAM_ROSTER_BACKUP_METADATA_KEY, JSON.stringify({
    key: backup.key,
    version: backup.version,
    dismissed: true,
    boardPrunes: backup.boardPrunes,
    prunedTalentIds: backup.prunedTalentIds,
  }));
}

export function restoreRosterBackup(
  storage: StorageReader & StorageWriter,
  rosterCommit: string,
  validCardIds: ReadonlySet<string>,
  catalogs?: TeamRosterCatalogs,
): LoadedTeamRoster | null {
  const backup = loadRosterBackup(storage);
  if (!backup) return null;
  storage.setItem(TEAM_ROSTER_STORAGE_KEY, backup.raw);
  return loadTeamRoster(storage, rosterCommit, validCardIds, catalogs);
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

export type BoardOwnedRosterFields = {
  rosterCommit: string;
  playerLevel: number | null;
  boards: Record<string, StoredTalentBoard>;
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

// Calculator-owned fields carried VERBATIM from whatever is currently stored,
// regardless of the record's version tag: a foreign or future version must
// never cause the planner's write to erase readable cards, Oshi preferences,
// or lock selections. Structural filters keep the static types honest; the
// loader still sanitizes on every read.
function readPreservedCalculatorFields(
  storage: StorageReader,
): Pick<StoredTeamRoster, "cards" | "oshi" | "requiredMemberCardIds"> {
  const preserved: Pick<StoredTeamRoster, "cards" | "oshi" | "requiredMemberCardIds"> = {
    cards: {},
    oshi: { enabled: false, talentId: null, role: "member" },
    requiredMemberCardIds: [],
  };
  const raw = storage.getItem(TEAM_ROSTER_STORAGE_KEY);
  if (!raw) return preserved;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return preserved;
  }
  if (!isObject(parsed)) return preserved;
  if (isObject(parsed.cards)) {
    for (const [cardId, bloomStage] of Object.entries(parsed.cards)) {
      if (isBloomStage(bloomStage)) preserved.cards[cardId] = bloomStage;
    }
  }
  if (isObject(parsed.oshi)) {
    preserved.oshi = {
      enabled: parsed.oshi.enabled === true,
      talentId:
        typeof parsed.oshi.talentId === "string" && parsed.oshi.talentId.length > 0
          ? parsed.oshi.talentId
          : null,
      role: isOshiRole(parsed.oshi.role) ? parsed.oshi.role : "member",
    };
  }
  if (Array.isArray(parsed.requiredMemberCardIds)) {
    preserved.requiredMemberCardIds = parsed.requiredMemberCardIds.filter(
      (cardId): cardId is string => typeof cardId === "string",
    );
  }
  return preserved;
}

// The Board planner owns playerLevel/boards; merge only those fields so a
// planner autosave cannot erase cards, Oshi preferences, or calculator locks —
// even when the stored record carries an unsupported version tag.
export function saveTeamRosterBoardFields(
  storage: StorageReader & StorageWriter,
  fields: BoardOwnedRosterFields,
): void {
  saveTeamRoster(storage, {
    ...emptyTeamRoster(fields.rosterCommit),
    ...readPreservedCalculatorFields(storage),
    playerLevel: fields.playerLevel,
    boards: fields.boards,
  });
}
