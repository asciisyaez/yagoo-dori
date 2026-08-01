/// <reference lib="webworker" />

import { calculateOwnedRosterTeam, TeamCalculatorError } from "@yagoo-dori/core/team-calculator";

import type {
  TeamCalculatorWorkerRequestMessage,
  TeamCalculatorWorkerResponseMessage,
} from "../lib/team-calculator-worker-client";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<TeamCalculatorWorkerRequestMessage>) => {
  if (event.data.type !== "calculate") return;
  try {
    const result = calculateOwnedRosterTeam(event.data.payload);
    const response: TeamCalculatorWorkerResponseMessage = { type: "result", payload: result };
    workerScope.postMessage(response);
  } catch (error) {
    const calculatorError = error instanceof TeamCalculatorError ? error : null;
    const response: TeamCalculatorWorkerResponseMessage = {
      type: "error",
      code: calculatorError?.code ?? "calculation-failed",
      message: calculatorError?.message ?? "The team calculation could not finish.",
    };
    workerScope.postMessage(response);
  }
};

export {};
