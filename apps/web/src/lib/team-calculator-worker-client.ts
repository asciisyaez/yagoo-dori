import type {
  TeamCalculatorRequest,
  TeamCalculatorResult,
} from "@yagoo-dori/core/team-calculator-contract";
import { TeamCalculatorResultSchema } from "@yagoo-dori/core/team-calculator-contract";

export type TeamCalculatorWorkerRequestMessage = Readonly<{
  type: "calculate";
  payload: TeamCalculatorRequest;
}>;

export type TeamCalculatorWorkerResponseMessage =
  | Readonly<{
      type: "result";
      payload: TeamCalculatorResult;
    }>
  | Readonly<{
      type: "error";
      code: string;
      message: string;
    }>;

export type TeamCalculatorTask = Readonly<{
  result: Promise<TeamCalculatorResult>;
  cancel: () => void;
}>;

export class TeamCalculatorWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TeamCalculatorWorkerError";
    this.code = code;
  }
}

/**
 * Starts the CPU-heavy optimizer in an isolated, lazy-loaded browser worker.
 * Cancelling terminates the worker immediately; no computation runs in Next's
 * request handler or on React's main thread.
 */
export function startTeamCalculation(request: TeamCalculatorRequest): TeamCalculatorTask {
  const worker = new Worker(new URL("../workers/team-calculator.worker.ts", import.meta.url), {
    type: "module",
    name: "yagoo-dori-team-calculator",
  });
  let settled = false;
  let rejectTask: ((reason: unknown) => void) | null = null;

  const cleanup = (): void => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };

  const result = new Promise<TeamCalculatorResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<TeamCalculatorWorkerResponseMessage>) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (event.data.type === "error") {
        reject(new TeamCalculatorWorkerError(event.data.code, event.data.message));
        return;
      }
      const parsed = TeamCalculatorResultSchema.safeParse(event.data.payload);
      if (!parsed.success) {
        reject(new TeamCalculatorWorkerError("invalid-worker-result", "The calculation result was invalid."));
        return;
      }
      resolve(parsed.data);
    };
    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new TeamCalculatorWorkerError("worker-failed", "The team calculation could not finish."));
    };
    const message: TeamCalculatorWorkerRequestMessage = { type: "calculate", payload: request };
    worker.postMessage(message);
  });

  return {
    result,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectTask?.(new TeamCalculatorWorkerError("cancelled", "The team calculation was cancelled."));
    },
  };
}
