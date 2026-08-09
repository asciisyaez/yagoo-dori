import { afterEach, describe, expect, it, vi } from "vitest";

import type { TeamCalculatorRequest } from "@yagoo-dori/core/team-calculator-contract";

import {
  startTeamCalculation,
  TeamCalculatorWorkerError,
  type TeamCalculatorWorkerRequestMessage,
  type TeamCalculatorWorkerResponseMessage,
} from "./team-calculator-worker-client";

const REQUEST: TeamCalculatorRequest = {
  schemaVersion: 5,
  rosterCommit: "a".repeat(40),
  ownedCards: Array.from({ length: 5 }, (_, index) => ({
    cardId: `card-${index}`,
    bloomStage: 0,
  })),
  requiredMemberCardIds: [],
  searchEffort: "thorough",
  seedCandidates: [{
    leaderOutfitCardId: "card-0",
    memberCardIds: ["card-0", "card-1", "card-2", "card-3", "card-4"],
  }],
};

class FakeWorker {
  static instance: FakeWorker | null = null;

  onmessage: ((event: MessageEvent<TeamCalculatorWorkerResponseMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: TeamCalculatorWorkerRequestMessage | null = null;
  terminated = false;

  constructor() {
    FakeWorker.instance = this;
  }

  postMessage(message: TeamCalculatorWorkerRequestMessage) {
    this.posted = message;
  }

  terminate() {
    this.terminated = true;
  }

  respond(response: TeamCalculatorWorkerResponseMessage) {
    this.onmessage?.({ data: response } as MessageEvent<TeamCalculatorWorkerResponseMessage>);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instance = null;
});

describe("team calculator worker client", () => {
  it("starts work only when requested and can terminate an in-flight calculation", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    expect(FakeWorker.instance).toBeNull();
    const task = startTeamCalculation(REQUEST);
    const worker = FakeWorker.instance;
    if (!worker) throw new Error("Worker was not created");
    expect(worker.posted).toEqual({ type: "calculate", payload: REQUEST });
    expect(worker.posted?.payload.seedCandidates).toEqual(REQUEST.seedCandidates);

    const rejection = expect(task.result).rejects.toMatchObject({
      name: "TeamCalculatorWorkerError",
      code: "cancelled",
    });
    task.cancel();
    await rejection;
    expect(worker.terminated).toBe(true);
  });

  it("returns safe calculator errors from the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const task = startTeamCalculation(REQUEST);
    const worker = FakeWorker.instance;
    if (!worker) throw new Error("Worker was not created");

    worker.respond({ type: "error", code: "stale-roster", message: "Review the saved roster." });

    await expect(task.result).rejects.toEqual(
      new TeamCalculatorWorkerError("stale-roster", "Review the saved roster."),
    );
    expect(worker.terminated).toBe(true);
  });

  it("rejects malformed worker output at the boundary", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const task = startTeamCalculation(REQUEST);
    const worker = FakeWorker.instance;
    if (!worker) throw new Error("Worker was not created");

    worker.respond({ type: "result", payload: {} as never });

    await expect(task.result).rejects.toMatchObject({ code: "invalid-worker-result" });
    expect(worker.terminated).toBe(true);
  });
});
