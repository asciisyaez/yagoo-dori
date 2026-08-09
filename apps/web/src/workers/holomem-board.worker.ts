/// <reference lib="webworker" />

import { planHolomemBoard } from "@yagoo-dori/core/holomem-board-planner";

import type {
  HolomemBoardWorkerRequestMessage,
  HolomemBoardWorkerResponseMessage,
} from "../lib/holomem-board-worker-client";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<HolomemBoardWorkerRequestMessage>) => {
  if (event.data.type !== "calculate") return;
  try {
    const result = planHolomemBoard(event.data.payload);
    const response: HolomemBoardWorkerResponseMessage = { type: "result", payload: result };
    workerScope.postMessage(response);
  } catch (error) {
    const response: HolomemBoardWorkerResponseMessage = {
      type: "error",
      code: "planning-failed",
      message: error instanceof Error ? error.message : "The Board plan could not finish.",
    };
    workerScope.postMessage(response);
  }
};

export {};
