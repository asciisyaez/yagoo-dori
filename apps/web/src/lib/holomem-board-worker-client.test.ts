import { afterEach, describe, expect, it, vi } from "vitest";

import type { HolomemBoardRequest } from "@yagoo-dori/core/holomem-board-contract";

import {
  HolomemBoardWorkerError,
  startHolomemBoardPlanning,
  type HolomemBoardWorkerRequestMessage,
  type HolomemBoardWorkerResponseMessage,
} from "./holomem-board-worker-client";

const REQUEST: HolomemBoardRequest = {
  schemaVersion: 2,
  rosterCommit: "a".repeat(40),
  playerLevel: null,
  team: {
    leader: { talentId: "talent-0", cardId: "card-0", lens: "one-copy-max" },
    members: Array.from({ length: 5 }, (_, index) => ({
      talentId: `talent-${index}`,
      cardId: `card-${index}`,
      lens: "one-copy-max" as const,
    })),
  },
  connectCandidates: [],
  boards: Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`talent-${index}`, {
    rank: 1,
    pointMode: "estimate-from-rank" as const,
    extraPoints: 0,
    directPoints: null,
    unlockedNodeGroupIds: [],
    connectPlacements: {},
  }])),
};

const RESULT = {
  schemaVersion: 2 as const,
  claim: {
    kind: "bounded-suggestion" as const,
    conditionalOn: "current-team-and-declared-board-state" as const,
    adjacencyBasis: "derived-orthogonal-grid-adjacency" as const,
    stackingModel: "additive-envelope-not-jointly-attainable" as const,
    unitConnectRule: "independent-user-confirmed" as const,
    globallyCertified: false as const,
  },
  perMember: REQUEST.team.members.map((member, index) => ({
    talentId: member.talentId,
    cardId: member.cardId,
    position: index === 0 ? "leader" as const : "member" as const,
    ledger: { pointMode: "estimate-from-rank" as const, directPoints: null, rankIncome: 0, extraPoints: 0, totalAvailable: 0, alreadySpent: 0, remainingAvailable: 0, suggestedCost: 0 },
    claimedMicroUnits: 0,
    greedyBaselineMicroUnits: 0,
    suggestions: [],
  })),
  connect: {
    assignment: "hungarian-complete" as const,
    unitConnectRule: "independent-user-confirmed" as const,
    amplificationModel: "multiplier-total" as const,
    assignments: [],
    lockedSlots: [],
    excludedCandidates: [],
  },
  noteCodes: [],
};

class FakeWorker {
  static instance: FakeWorker | null = null;

  onmessage: ((event: MessageEvent<HolomemBoardWorkerResponseMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: HolomemBoardWorkerRequestMessage | null = null;
  terminated = false;

  constructor() {
    FakeWorker.instance = this;
  }

  postMessage(message: HolomemBoardWorkerRequestMessage) {
    this.posted = message;
  }

  terminate() {
    this.terminated = true;
  }

  respond(response: HolomemBoardWorkerResponseMessage) {
    this.onmessage?.({ data: response } as MessageEvent<HolomemBoardWorkerResponseMessage>);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instance = null;
});

describe("holomem Board worker client", () => {
  it("starts work with the shared request and can cancel it", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const task = startHolomemBoardPlanning(REQUEST);
    const worker = FakeWorker.instance;
    if (!worker) throw new Error("Worker was not created");
    expect(worker.posted).toEqual({ type: "calculate", payload: REQUEST });

    const rejection = expect(task.result).rejects.toMatchObject({ code: "cancelled" });
    task.cancel();
    await rejection;
    expect(worker.terminated).toBe(true);
  });

  it("returns coded worker errors", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const task = startHolomemBoardPlanning(REQUEST);
    const worker = FakeWorker.instance;
    if (!worker) throw new Error("Worker was not created");

    worker.respond({ type: "error", code: "planning-failed", message: "The Board plan failed." });

    await expect(task.result).rejects.toEqual(new HolomemBoardWorkerError("planning-failed", "The Board plan failed."));
    expect(worker.terminated).toBe(true);
  });

  it("re-parses worker output and rejects malformed replies", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const validTask = startHolomemBoardPlanning(REQUEST);
    const validWorker = FakeWorker.instance;
    if (!validWorker) throw new Error("Worker was not created");
    validWorker.respond({ type: "result", payload: RESULT });
    await expect(validTask.result).resolves.toEqual(RESULT);

    const invalidTask = startHolomemBoardPlanning(REQUEST);
    const invalidWorker = FakeWorker.instance;
    if (!invalidWorker) throw new Error("Worker was not created");
    invalidWorker.respond({ type: "result", payload: {} as never });
    await expect(invalidTask.result).rejects.toMatchObject({ code: "invalid-worker-result" });
    expect(invalidWorker.terminated).toBe(true);
  });
});
