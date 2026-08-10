"use client";

import {
  mechanicsData,
  publicCards,
  publicData,
  replayHolomemBoardAutoUnlock,
} from "@yagoo-dori/core";
import { holomemRankIncome } from "@yagoo-dori/core/holomem-board-contract";
import type {
  HolomemBoardRequest,
  HolomemBoardResult,
} from "@yagoo-dori/core/holomem-board-contract";
import type { TeamCalculatorRequest } from "@yagoo-dori/core/team-calculator-contract";
import { Network } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  startHolomemBoardPlanning,
  type HolomemBoardPlanningTask,
} from "@/lib/holomem-board-worker-client";
import {
  startTeamCalculation,
  type TeamCalculatorTask,
} from "@/lib/team-calculator-worker-client";
import {
  overlayForAssignment,
  reachableGroups,
  shortestConnectionPath,
} from "@/lib/board-planner-logic";
import {
  loadTeamRoster,
  saveTeamRosterBoardFields,
  type BoardConnectSlot,
  type StoredTalentBoard,
  type StoredOshiPreference,
} from "@/lib/team-roster-storage";

import { BoardEditor } from "./board-editor";
import { ConnectAssignments } from "./connect-assignments";
import { SuggestionResults } from "./suggestion-results";
import type { BoardConnectOverlay } from "./board-svg";
import {
  TeamSourcePanel,
  type ManualTeamSelection,
  type PlannerCardOption,
} from "./team-source-panel";

const ROSTER_COMMIT = publicData.sourceSnapshots.english.commit;
const DEFAULT_BOARD: StoredTalentBoard = {
  rank: 1,
  pointMode: "estimate-from-rank",
  extraPoints: 0,
  directPoints: null,
  unlockedNodeGroupIds: [],
  connectPlacements: {},
};

type BoardMap = Record<string, StoredTalentBoard>;
type BoardTeam = HolomemBoardRequest["team"];

type ConnectOverlay = BoardConnectOverlay & Readonly<{
  talentId: string;
}>;

function cloneBoard(board: StoredTalentBoard): StoredTalentBoard {
  return {
    ...board,
    unlockedNodeGroupIds: [...board.unlockedNodeGroupIds],
    connectPlacements: { ...board.connectPlacements },
  };
}

function plannerCard(card: (typeof publicCards)[number], bloomStage: 0 | 1 | 2 | 3 | 4 | 5): PlannerCardOption {
  return {
    id: card.id,
    talentId: card.talentId,
    talentName: card.talentName,
    title: card.title,
    rarity: card.rarity,
    bloomStage,
  };
}

function uniqueTalentCardIds(cards: readonly PlannerCardOption[]): string[] {
  const seen = new Set<string>();
  return [...cards]
    .sort((left, right) => left.talentName.localeCompare(right.talentName) || right.rarity - left.rarity || left.id.localeCompare(right.id))
    .filter((card) => {
      if (seen.has(card.talentId)) return false;
      seen.add(card.talentId);
      return true;
    })
    .slice(0, 5)
    .map((card) => card.id);
}

function teamFromSelection(selection: ManualTeamSelection, cardById: ReadonlyMap<string, PlannerCardOption>): BoardTeam | null {
  const cardIds = [selection.leaderCardId, ...selection.memberCardIds];
  const leaderCard = cardById.get(selection.leaderCardId);
  const memberCards = selection.memberCardIds.map((cardId) => cardById.get(cardId));
  if (!leaderCard || memberCards.some((card) => !card)) return null;
  const members = memberCards.filter((card): card is PlannerCardOption => card !== undefined);
  if (members.length !== 5 || new Set(cardIds).size < 5 || new Set(members.map((card) => card.talentId)).size !== 5) return null;
  if (!members.some((card) => card.talentId === leaderCard.talentId)) return null;
  return {
    leader: { talentId: leaderCard.talentId, cardId: leaderCard.id, lens: "one-copy-max" },
    members: members.map((card) => ({ talentId: card.talentId, cardId: card.id, lens: "one-copy-max" })),
  };
}

function teamSelectionFromTeam(team: BoardTeam): ManualTeamSelection {
  return {
    leaderCardId: team.leader.cardId,
    memberCardIds: team.members.map((member) => member.cardId),
  };
}

function boardsForTeam(team: BoardTeam, current: BoardMap): BoardMap {
  const next: BoardMap = {};
  for (const member of team.members) next[member.talentId] = cloneBoard(current[member.talentId] ?? DEFAULT_BOARD);
  return next;
}

function suggestionPath(
  talentId: string,
  groupId: string,
  result: HolomemBoardResult | null,
  board: StoredTalentBoard,
): Set<string> {
  const member = result?.perMember.find((candidate) => candidate.talentId === talentId);
  if (!member) return new Set();
  const byGroup = new Map(member.suggestions.map((suggestion) => [suggestion.nodeGroupId, suggestion]));
  const unlocked = new Set(["S-001", ...board.unlockedNodeGroupIds]);
  const path = new Set<string>();
  let current = byGroup.get(groupId);
  while (current && !unlocked.has(current.nodeGroupId)) {
    path.add(current.nodeGroupId);
    if (current.pathParentGroupId === "start" || unlocked.has(current.pathParentGroupId)) break;
    current = byGroup.get(current.pathParentGroupId);
  }
  return path;
}

function teamCalculatorRequest(
  cards: readonly PlannerCardOption[],
  requiredMemberCardIds: readonly string[],
  oshi: StoredOshiPreference,
  rosterCommit: string,
): TeamCalculatorRequest {
  const request: TeamCalculatorRequest = {
    schemaVersion: 5,
    rosterCommit,
    ownedCards: cards.map((card) => ({ cardId: card.id, bloomStage: card.bloomStage })),
    requiredMemberCardIds: [...requiredMemberCardIds].sort(),
    searchEffort: "thorough",
  };
  if (oshi.enabled && oshi.talentId) request.oshi = { talentId: oshi.talentId, role: oshi.role };
  return request;
}

export function BoardPlanner() {
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [ownedCards, setOwnedCards] = useState<PlannerCardOption[]>([]);
  const [plannerCards, setPlannerCards] = useState<PlannerCardOption[]>([]);
  const [calculatorRequiredMemberCardIds, setCalculatorRequiredMemberCardIds] = useState<string[]>([]);
  const [calculatorOshi, setCalculatorOshi] = useState<StoredOshiPreference>({ enabled: false, talentId: null, role: "member" });
  const [team, setTeam] = useState<BoardTeam | null>(null);
  const [manualSelection, setManualSelection] = useState<ManualTeamSelection>({ leaderCardId: "", memberCardIds: ["", "", "", "", ""] });
  const [boards, setBoards] = useState<BoardMap>({});
  const [playerLevel, setPlayerLevel] = useState<number | null>(null);
  const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null);
  const [selectedGroupByTalent, setSelectedGroupByTalent] = useState<Record<string, string | null>>({});
  const [focusedGroupByTalent, setFocusedGroupByTalent] = useState<Record<string, string | null>>({});
  const [editModeByTalent, setEditModeByTalent] = useState<Record<string, boolean>>({});
  const [zoomByTalent, setZoomByTalent] = useState<Record<string, number>>({});
  const [historyByTalent, setHistoryByTalent] = useState<Record<string, StoredTalentBoard[]>>({});
  const [connectOverlay, setConnectOverlay] = useState<ConnectOverlay | null>(null);
  const [result, setResult] = useState<HolomemBoardResult | null>(null);
  const [stale, setStale] = useState(false);
  const [running, setRunning] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const boardTask = useRef<HolomemBoardPlanningTask | null>(null);
  const teamTask = useRef<TeamCalculatorTask | null>(null);
  const requestGeneration = useRef(0);

  const validCardIds = useMemo(() => new Set(publicCards.map((card) => card.id)), []);
  const cardById = useMemo(() => new Map(plannerCards.map((card) => [card.id, card])), [plannerCards]);
  const validTalentIds = useMemo(() => new Set(publicCards.map((card) => card.talentId)), []);
  const talentNameByTalentId = useMemo(
    () => new Map(publicCards.map((card) => [card.talentId, card.talentName])),
    [],
  );
  const validBoardNodeGroupIds = useMemo(() => new Set(mechanicsData.catalogs.boardNodes.map((node) => node.groupId)), []);

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try {
        const loaded = loadTeamRoster(window.localStorage, ROSTER_COMMIT, validCardIds, { validTalentIds, validBoardNodeGroupIds });
        const ownedCards = Object.entries(loaded.roster.cards)
          .map(([cardId, bloomStage]) => {
            const card = publicCards.find((candidate) => candidate.id === cardId);
            return card ? plannerCard(card, bloomStage) : null;
          })
          .filter((card): card is PlannerCardOption => card !== null)
          .filter((card) => card.rarity === 4 || card.rarity === 5);
        const cards = ownedCards.length >= 5 ? ownedCards : publicCards.map((card) => plannerCard(card, 0));
        const seedIds = uniqueTalentCardIds(cards);
        const selection: ManualTeamSelection = {
          leaderCardId: seedIds[0] ?? "",
          memberCardIds: [seedIds[0] ?? "", ...seedIds.slice(1), "", ""].slice(0, 5),
        };
        setPlannerCards(cards);
        setOwnedCards(ownedCards);
        setCalculatorRequiredMemberCardIds(loaded.roster.requiredMemberCardIds);
        setCalculatorOshi(loaded.roster.oshi);
        setManualSelection(selection);
        setBoards(loaded.roster.boards);
        setPlayerLevel(loaded.roster.playerLevel);
        setStorageAvailable(ownedCards.length >= 5);
        if (loaded.needsWrite) {
          saveTeamRosterBoardFields(window.localStorage, {
            rosterCommit: ROSTER_COMMIT,
            playerLevel: loaded.roster.playerLevel,
            boards: loaded.roster.boards,
          });
        }
      } catch {
        setPlannerCards(publicCards.map((card) => plannerCard(card, 0)));
        setOwnedCards([]);
        setCalculatorRequiredMemberCardIds([]);
        setCalculatorOshi({ enabled: false, talentId: null, role: "member" });
        setStorageAvailable(false);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [validBoardNodeGroupIds, validCardIds, validTalentIds]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveTeamRosterBoardFields(window.localStorage, { rosterCommit: ROSTER_COMMIT, playerLevel, boards });
    } catch { /* Storage failures leave the in-memory planner usable. */ }
  }, [boards, hydrated, playerLevel]);

  useEffect(() => () => {
    boardTask.current?.cancel();
    teamTask.current?.cancel();
  }, []);

  const markChanged = useCallback(() => {
    requestGeneration.current += 1;
    boardTask.current?.cancel();
    boardTask.current = null;
    teamTask.current?.cancel();
    teamTask.current = null;
    setRunning(false);
    setSourceLoading(false);
    setConnectOverlay(null);
    if (result) setStale(true);
    setRunError(null);
  }, [result]);

  const ensureTeamBoards = useCallback((nextTeam: BoardTeam) => {
    setBoards((current) => boardsForTeam(nextTeam, current));
    setSelectedTalentId(nextTeam.members[0]?.talentId ?? null);
  }, []);

  const applyManualSelection = useCallback((selection: ManualTeamSelection) => {
    setManualSelection(selection);
    const nextTeam = teamFromSelection(selection, cardById);
    setTeam(nextTeam);
    if (nextTeam) ensureTeamBoards(nextTeam);
    markChanged();
  }, [cardById, ensureTeamBoards, markChanged]);

  const useCalculatorResult = useCallback(() => {
    if (!storageAvailable || plannerCards.length < 5) return;
    teamTask.current?.cancel();
    const task = startTeamCalculation(teamCalculatorRequest(plannerCards, calculatorRequiredMemberCardIds, calculatorOshi, ROSTER_COMMIT));
    teamTask.current = task;
    setSourceLoading(true);
    void task.result.then((nextResult) => {
      if (teamTask.current !== task) return;
      teamTask.current = null;
      const nextTeam: BoardTeam = {
        leader: { talentId: nextResult.leader.talentId, cardId: nextResult.leader.cardId, lens: "one-copy-max" },
        members: nextResult.members.map((member) => ({ talentId: member.talentId, cardId: member.cardId, lens: "one-copy-max" })),
      };
      setTeam(nextTeam);
      setManualSelection(teamSelectionFromTeam(nextTeam));
      ensureTeamBoards(nextTeam);
      setSourceLoading(false);
      markChanged();
    }).catch(() => {
      if (teamTask.current !== task) return;
      teamTask.current = null;
      setSourceLoading(false);
      setRunError("The stored team could not be loaded.");
    });
  }, [calculatorOshi, calculatorRequiredMemberCardIds, ensureTeamBoards, markChanged, plannerCards, storageAvailable]);

  const updateBoard = useCallback((talentId: string, patch: Partial<StoredTalentBoard>) => {
    setBoards((current) => {
      const previous = current[talentId] ?? DEFAULT_BOARD;
      setHistoryByTalent((history) => ({
        ...history,
        [talentId]: [...(history[talentId] ?? []), cloneBoard(previous)].slice(-10),
      }));
      return { ...current, [talentId]: { ...cloneBoard(previous), ...patch } };
    });
    markChanged();
  }, [markChanged]);

  const toggleNode = useCallback((talentId: string, groupId: string) => {
    const node = mechanicsData.catalogs.boardNodes.find((candidate) => candidate.groupId === groupId);
    if (!node || node.kind === "all-member" || node.kind === "content") return;
    const board = boards[talentId] ?? DEFAULT_BOARD;
    const unlocked = new Set(["S-001", ...board.unlockedNodeGroupIds]);
    if (unlocked.has(groupId)) {
      if (groupId === "S-001") return;
      unlocked.delete(groupId);
      const reachable = reachableGroups(unlocked);
      for (const existing of [...unlocked]) if (!reachable.has(existing)) unlocked.delete(existing);
      const removed = board.unlockedNodeGroupIds.filter((existing) => !unlocked.has(existing));
      updateBoard(talentId, { unlockedNodeGroupIds: [...unlocked].filter((id) => id !== "S-001").sort() });
      if (removed.length > 0) {
        setToast(`${removed.length} unreachable node${removed.length === 1 ? "" : "s"} cleared. Use Undo to restore.`);
        window.setTimeout(() => setToast(null), 3_000);
      }
      return;
    }
    const path = shortestConnectionPath(groupId, unlocked);
    updateBoard(talentId, { unlockedNodeGroupIds: [...new Set([...board.unlockedNodeGroupIds, ...path, groupId])].sort() });
    if (path.length > 0) {
      setToast(`Added a ${path.length}-node connecting path.`);
      window.setTimeout(() => setToast(null), 3_000);
    }
  }, [boards, updateBoard]);

  const changePlacement = useCallback((talentId: string, slot: BoardConnectSlot, cardId: string | undefined) => {
    setBoards((current) => {
      const next: BoardMap = Object.fromEntries(Object.entries(current).map(([id, board]) => [id, cloneBoard(board)]));
      for (const board of Object.values(next)) {
        for (const [existingSlot, existingCardId] of Object.entries(board.connectPlacements)) {
          if (existingCardId === cardId && cardId !== undefined) delete board.connectPlacements[existingSlot as BoardConnectSlot];
        }
      }
      const board = next[talentId] ?? cloneBoard(DEFAULT_BOARD);
      if (cardId) board.connectPlacements[slot] = cardId;
      else delete board.connectPlacements[slot];
      next[talentId] = board;
      return next;
    });
    markChanged();
  }, [markChanged]);

  const copyFrom = useCallback((talentId: string, sourceTalentId: string) => {
    const source = boards[sourceTalentId];
    if (!source) return;
    updateBoard(talentId, {
      rank: source.rank,
      pointMode: source.pointMode,
      extraPoints: source.extraPoints,
      directPoints: source.directPoints,
      unlockedNodeGroupIds: [...source.unlockedNodeGroupIds],
    });
  }, [boards, updateBoard]);

  const clearBoard = useCallback((talentId: string) => {
    updateBoard(talentId, { unlockedNodeGroupIds: [], connectPlacements: {} });
  }, [updateBoard]);

  const undoBoard = useCallback((talentId: string) => {
    const history = historyByTalent[talentId] ?? [];
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistoryByTalent((current) => ({ ...current, [talentId]: history.slice(0, -1) }));
    setBoards((current) => ({ ...current, [talentId]: cloneBoard(previous) }));
    markChanged();
  }, [historyByTalent, markChanged]);

  const buildRequest = useCallback((): HolomemBoardRequest | null => {
    if (!team) return null;
    const memberBoards = boardsForTeam(team, boards);
    if (team.members.some((member) => !memberBoards[member.talentId])) return null;
    return {
      schemaVersion: 1,
      rosterCommit: ROSTER_COMMIT,
      playerLevel,
      team,
      connectCandidates: ownedCards.map((card) => ({ cardId: card.id, bloomStage: card.bloomStage })),
      boards: Object.fromEntries(team.members.map((member) => {
        const board = memberBoards[member.talentId]!;
        return [member.talentId, { ...board, connectPlacements: { ...board.connectPlacements } }];
      })),
    };
  }, [boards, ownedCards, playerLevel, team]);

  const runPlanner = useCallback(() => {
    const request = buildRequest();
    if (!request) {
      setRunError("Choose five unique team talents before running suggestions.");
      return;
    }
    boardTask.current?.cancel();
    const task = startHolomemBoardPlanning(request);
    boardTask.current = task;
    const taskGeneration = ++requestGeneration.current;
    setRunning(true);
    setRunError(null);
    void task.result.then((nextResult) => {
      if (boardTask.current !== task || requestGeneration.current !== taskGeneration) return;
      boardTask.current = null;
      setResult(nextResult);
      setStale(false);
      setRunning(false);
    }).catch(() => {
      if (boardTask.current !== task || requestGeneration.current !== taskGeneration) return;
      boardTask.current = null;
      setRunning(false);
      setRunError("The Board suggestions could not finish.");
    });
  }, [buildRequest]);

  const currentMember = team?.members.find((member) => member.talentId === selectedTalentId) ?? team?.members[0] ?? null;
  const currentBoard = currentMember ? boards[currentMember.talentId] ?? DEFAULT_BOARD : null;
  const currentSuggestions = result?.perMember.find((member) => member.talentId === currentMember?.talentId)?.suggestions ?? [];
  const currentSelectedGroup = currentMember ? selectedGroupByTalent[currentMember.talentId] ?? null : null;
  const currentOverlay = connectOverlay?.talentId === currentMember?.talentId ? connectOverlay : null;
  const currentPath = currentMember && currentBoard && currentSelectedGroup
    ? suggestionPath(currentMember.talentId, currentSelectedGroup, result, currentBoard)
    : new Set<string>();
  const currentTalentName = currentMember ? plannerCards.find((card) => card.talentId === currentMember.talentId)?.talentName ?? currentMember.talentId : "Board";
  const copySources = team?.members
    .filter((member) => member.talentId !== currentMember?.talentId)
    .map((member) => ({
      talentId: member.talentId,
      label: talentNameByTalentId.get(member.talentId) ?? member.talentId,
    })) ?? [];

  const autoUnlock = useCallback(() => {
    if (!currentMember || !currentBoard) return;
    const totalPoints = currentBoard.pointMode === "direct"
      ? currentBoard.directPoints ?? 0
      : holomemRankIncome(currentBoard.rank) + currentBoard.extraPoints;
    try {
      const replay = replayHolomemBoardAutoUnlock({
        talentId: currentMember.talentId,
        unlockedNodeGroupIds: currentBoard.unlockedNodeGroupIds,
        totalPoints,
        playerLevel,
      });
      updateBoard(currentMember.talentId, { unlockedNodeGroupIds: [...replay.unlockedNodeGroupIds] });
      setToast(replay.addedNodeGroupIds.length > 0
        ? `Added ${replay.addedNodeGroupIds.length} nodes by catalog auto-unlock priority.`
        : "No additional nodes fit the declared points and gates.");
      window.setTimeout(() => setToast(null), 3_000);
    } catch {
      setRunError("The catalog auto-unlock priority could not be replayed for this Board.");
    }
  }, [currentBoard, currentMember, playerLevel, updateBoard]);

  const handleConnectHover = useCallback((groupId: string | null) => {
    if (!currentMember || !result || connectOverlay?.pinned) return;
    const assignment = groupId
      ? result.connect.assignments.find((candidate) => candidate.boardTalentId === currentMember.talentId && candidate.footprint.nodeGroupIds.includes(groupId))
      : null;
    const board = boards[currentMember.talentId] ?? DEFAULT_BOARD;
    setConnectOverlay(assignment ? { talentId: currentMember.talentId, ...overlayForAssignment(assignment, board) } : null);
  }, [boards, connectOverlay?.pinned, currentMember, result]);

  const handleConnectPin = useCallback((groupId: string) => {
    if (!currentMember || !result) return;
    const assignment = result.connect.assignments.find((candidate) => candidate.boardTalentId === currentMember.talentId && candidate.footprint.nodeGroupIds.includes(groupId));
    if (!assignment) return;
    if (connectOverlay?.pinned) setConnectOverlay(null);
    else {
      const board = boards[currentMember.talentId] ?? DEFAULT_BOARD;
      setConnectOverlay({ talentId: currentMember.talentId, ...overlayForAssignment(assignment, board), pinned: true });
    }
  }, [boards, connectOverlay?.pinned, currentMember, result]);

  const onManualSelection = useCallback((selection: ManualTeamSelection) => applyManualSelection(selection), [applyManualSelection]);
  const onPlayerLevel = (value: string) => {
    setPlayerLevel(value === "" ? null : Math.max(0, Number(value) || 0));
    markChanged();
  };

  return (
    <div className="hb-planner">
      <header className="hb-planner-heading">
        <div className="hb-heading-icon" aria-hidden="true"><Network /></div>
        <div>
          <p className="hb-eyebrow">Tools / Holomem Board</p>
          <h1>Plan your Board path</h1>
          <p>Declare each member Board, review connected unlock paths, and place owned Connect cards.</p>
        </div>
        <div className="hb-heading-chip">5 member Boards</div>
      </header>
      <section className="hb-how-it-works" aria-labelledby="hb-how-title">
        <details open>
          <summary id="hb-how-title">How these suggestions work</summary>
          <div className="hb-how-grid">
            <p><strong>Budget basis</strong><br />Rank income comes from the Holomem Rank catalog. Extra points or direct points follow your selected mode.</p>
            <p><strong>Derived adjacency</strong><br />Paths follow orthogonal grid adjacency. If a sequence disagrees with the game, that is the derivation being wrong, not your board.</p>
            <p><strong>Scope</strong><br />Green and yellow nodes are listed but not evaluated in suggestions.</p>
            <p><strong>Envelope stacking</strong><br />Listed Board effects use an additive envelope and are not presented as jointly attainable totals.</p>
          </div>
        </details>
      </section>
      <TeamSourcePanel
        cards={plannerCards}
        loading={sourceLoading}
        manualSelection={manualSelection}
        onManualSelection={onManualSelection}
        onUseCalculator={useCalculatorResult}
        rosterAvailable={storageAvailable}
        team={team}
      />
      <section className="hb-panel hb-shared-fields" aria-labelledby="hb-shared-fields-title">
        <div>
          <p className="hb-eyebrow">Shared input</p>
          <h2 id="hb-shared-fields-title">Dream Rank</h2>
        </div>
        <label>Optional player level
          <input min={0} type="number" value={playerLevel ?? ""} onChange={(event) => onPlayerLevel(event.target.value)} />
        </label>
        <p className="hb-muted">Leave empty to assume gates are met; gated suggestions will remain marked.</p>
      </section>
      {team && currentMember && currentBoard && (
        <section className="hb-board-workspace" aria-label="Board workspace">
          <div className="hb-member-tabs" role="tablist" aria-label="Team member Boards">
            {team.members.map((member) => {
              const name = plannerCards.find((card) => card.talentId === member.talentId)?.talentName ?? member.talentId;
              return <button aria-selected={member.talentId === currentMember.talentId} className={member.talentId === currentMember.talentId ? "hb-tab-active" : ""} key={member.talentId} onClick={() => { setSelectedTalentId(member.talentId); setConnectOverlay(null); }} role="tab" type="button">{name}</button>;
            })}
          </div>
          <BoardEditor
            board={currentBoard}
            connectCards={ownedCards}
            connectOverlay={currentOverlay}
            copySources={copySources}
            editMode={editModeByTalent[currentMember.talentId] ?? true}
            focusedGroupId={focusedGroupByTalent[currentMember.talentId] ?? null}
            highlightedPathGroupIds={currentPath}
            onBoardChange={(patch) => updateBoard(currentMember.talentId, patch)}
            onAutoUnlock={autoUnlock}
            onClear={() => clearBoard(currentMember.talentId)}
            onConnectHover={handleConnectHover}
            onConnectPin={handleConnectPin}
            onCopyFrom={(source) => copyFrom(currentMember.talentId, source)}
            onEditMode={(next) => setEditModeByTalent((current) => ({ ...current, [currentMember.talentId]: next }))}
            onFocusNode={(groupId) => setFocusedGroupByTalent((current) => ({ ...current, [currentMember.talentId]: groupId }))}
            onInspectNode={(groupId) => { setSelectedGroupByTalent((current) => ({ ...current, [currentMember.talentId]: groupId })); setEditModeByTalent((current) => ({ ...current, [currentMember.talentId]: false })); }}
            onPlacement={(slot, cardId) => changePlacement(currentMember.talentId, slot, cardId)}
            onToggleNode={(groupId) => toggleNode(currentMember.talentId, groupId)}
            onUndo={() => undoBoard(currentMember.talentId)}
            onZoomIn={() => setZoomByTalent((current) => ({ ...current, [currentMember.talentId]: Math.min(1.5, (current[currentMember.talentId] ?? 0.7) + 0.1) }))}
            onZoomOut={() => setZoomByTalent((current) => ({ ...current, [currentMember.talentId]: Math.max(0.4, (current[currentMember.talentId] ?? 0.7) - 0.1) }))}
            playerLevel={playerLevel}
            selectedGroupId={currentSelectedGroup}
            suggestions={currentSuggestions}
            talentId={currentMember.talentId}
            talentName={currentTalentName}
            toast={toast}
            zoom={zoomByTalent[currentMember.talentId] ?? 0.7}
          />
        </section>
      )}
      <div className="hb-run-row">
        <button className="hb-primary-button hb-run-button" disabled={!team || running} onClick={runPlanner} type="button">{running ? "Preparing suggestions…" : "Run suggestions"}</button>
        {runError && <p className="hb-error" role="alert">{runError}</p>}
      </div>
      <SuggestionResults
        onRunAgain={runPlanner}
        onSelectMember={(talentId) => { setSelectedTalentId(talentId); setConnectOverlay(null); }}
        onSelectSuggestion={(talentId, groupId) => { setSelectedTalentId(talentId); setSelectedGroupByTalent((current) => ({ ...current, [talentId]: groupId })); setEditModeByTalent((current) => ({ ...current, [talentId]: false })); }}
        result={result}
        stale={stale}
        talentNameByTalentId={talentNameByTalentId}
      />
      {result && <ConnectAssignments boards={boards} cards={plannerCards} connect={result.connect} stale={stale} />}
      {!team && hydrated && <p className="hb-empty-state">Choose a leader and five member talents to open the Board editor.</p>}
    </div>
  );
}
