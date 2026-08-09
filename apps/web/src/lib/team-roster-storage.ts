export const TEAM_ROSTER_STORAGE_KEY = "yagoo-dori:team-calculator-roster";

export const BLOOM_STAGES = [0, 1, 2, 3, 4, 5] as const;

export type BloomStage = (typeof BLOOM_STAGES)[number];

export const TEAM_OSHI_ROLES = ["member", "leader", "member-and-leader"] as const;

export type StoredOshiRole = (typeof TEAM_OSHI_ROLES)[number];

export type StoredOshiPreference = {
  enabled: boolean;
  talentId: string | null;
  role: StoredOshiRole;
};

export type StoredTeamRoster = {
  version: 3;
  rosterCommit: string;
  cards: Record<string, BloomStage>;
  oshi: StoredOshiPreference;
  requiredMemberCardIds: string[];
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export type LoadedTeamRoster = {
  roster: StoredTeamRoster;
  needsWrite: boolean;
};

function isBloomStage(value: unknown): value is BloomStage {
  return typeof value === "number" && BLOOM_STAGES.includes(value as BloomStage);
}

function isOshiRole(value: unknown): value is StoredOshiRole {
  return typeof value === "string" && TEAM_OSHI_ROLES.includes(value as StoredOshiRole);
}

export function emptyTeamRoster(rosterCommit: string): StoredTeamRoster {
  return {
    version: 3,
    rosterCommit,
    cards: {},
    oshi: { enabled: false, talentId: null, role: "member" },
    requiredMemberCardIds: [],
  };
}

export function loadTeamRoster(
  storage: StorageReader,
  rosterCommit: string,
  validCardIds: ReadonlySet<string>,
): LoadedTeamRoster {
  const empty = emptyTeamRoster(rosterCommit);
  const raw = storage.getItem(TEAM_ROSTER_STORAGE_KEY);
  if (!raw) return { roster: empty, needsWrite: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { roster: empty, needsWrite: true };
  }

  if (!parsed || typeof parsed !== "object") {
    return { roster: empty, needsWrite: true };
  }

  const candidate = parsed as {
    version?: unknown;
    rosterCommit?: unknown;
    cards?: unknown;
    oshi?: unknown;
    requiredMemberCardIds?: unknown;
  };
  if (
    (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3) ||
    !candidate.cards ||
    typeof candidate.cards !== "object"
  ) {
    return { roster: empty, needsWrite: true };
  }

  const cards: Record<string, BloomStage> = {};
  for (const [cardId, bloomStage] of Object.entries(candidate.cards)) {
    if (validCardIds.has(cardId) && isBloomStage(bloomStage)) cards[cardId] = bloomStage;
  }

  const candidateOshi = candidate.oshi && typeof candidate.oshi === "object"
    ? candidate.oshi as { enabled?: unknown; talentId?: unknown; role?: unknown }
    : null;
  const oshi: StoredOshiPreference = (candidate.version === 2 || candidate.version === 3) && candidateOshi
    ? {
        enabled: candidateOshi.enabled === true,
        talentId:
          typeof candidateOshi.talentId === "string" && candidateOshi.talentId.length > 0
            ? candidateOshi.talentId
            : null,
        role: isOshiRole(candidateOshi.role) ? candidateOshi.role : "member",
      }
    : empty.oshi;

  const requiredMemberCardIds = candidate.version === 3 && Array.isArray(candidate.requiredMemberCardIds)
    ? [...new Set(candidate.requiredMemberCardIds.filter(
        (cardId): cardId is string => typeof cardId === "string" && validCardIds.has(cardId) && cardId in cards,
      ))].sort().slice(0, 5)
    : [];

  const roster: StoredTeamRoster = { version: 3, rosterCommit, cards, oshi, requiredMemberCardIds };
  const needsWrite =
    candidate.version !== 3 ||
    candidate.rosterCommit !== rosterCommit ||
    Object.keys(cards).length !== Object.keys(candidate.cards).length ||
    !candidateOshi ||
    candidateOshi.enabled !== oshi.enabled ||
    candidateOshi.talentId !== oshi.talentId ||
    candidateOshi.role !== oshi.role ||
    !Array.isArray(candidate.requiredMemberCardIds) ||
    JSON.stringify(candidate.requiredMemberCardIds) !== JSON.stringify(requiredMemberCardIds);
  return { roster, needsWrite };
}

export function saveTeamRoster(storage: StorageWriter, roster: StoredTeamRoster): void {
  storage.setItem(TEAM_ROSTER_STORAGE_KEY, JSON.stringify(roster));
}
