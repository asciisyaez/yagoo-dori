import type {
  HolomemBoardRequest,
  HolomemBoardResult,
} from "@yagoo-dori/core/holomem-board-contract";
import { HolomemBoardResultSchema } from "@yagoo-dori/core/holomem-board-contract";

export type HolomemBoardWorkerRequestMessage = Readonly<{
  type: "calculate";
  payload: HolomemBoardRequest;
}>;

export type HolomemBoardWorkerResponseMessage =
  | Readonly<{
      type: "result";
      payload: HolomemBoardResult;
    }>
  | Readonly<{
      type: "error";
      code: string;
      message: string;
    }>;

export type HolomemBoardPlanningTask = Readonly<{
  result: Promise<HolomemBoardResult>;
  cancel: () => void;
}>;

export class HolomemBoardWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HolomemBoardWorkerError";
    this.code = code;
  }
}

export function startHolomemBoardPlanning(request: HolomemBoardRequest): HolomemBoardPlanningTask {
  let worker: Worker | null = null;
  let cleanedUp = false;
  let settled = false;
  let rejectTask: ((reason: unknown) => void) | null = null;

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    const currentWorker = worker;
    worker = null;
    if (!currentWorker) return;
    currentWorker.onmessage = null;
    currentWorker.onerror = null;
    currentWorker.terminate();
  };

  const result = new Promise<HolomemBoardResult>((resolve, reject) => {
    rejectTask = reject;
    let currentWorker: Worker;
    try {
      currentWorker = new Worker(new URL("../workers/holomem-board.worker.ts", import.meta.url), {
        type: "module",
        name: "yagoo-dori-holomem-board",
      });
      worker = currentWorker;
    } catch {
      settled = true;
      cleanup();
      reject(new HolomemBoardWorkerError("worker-start-failed", "The Board worker could not start."));
      return;
    }

    currentWorker.onmessage = (event: MessageEvent<HolomemBoardWorkerResponseMessage>) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (event.data.type === "error") {
        reject(new HolomemBoardWorkerError(event.data.code, event.data.message));
        return;
      }
      const parsed = HolomemBoardResultSchema.safeParse(event.data.payload);
      if (!parsed.success) {
        reject(new HolomemBoardWorkerError("invalid-worker-result", "The Board plan result was invalid."));
        return;
      }
      resolve(parsed.data);
    };
    currentWorker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new HolomemBoardWorkerError("worker-failed", "The Board plan could not finish."));
    };
    const message: HolomemBoardWorkerRequestMessage = { type: "calculate", payload: request };
    try {
      currentWorker.postMessage(message);
    } catch {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new HolomemBoardWorkerError("worker-post-failed", "The Board request could not be sent."));
    }
  });

  return {
    result,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectTask?.(new HolomemBoardWorkerError("cancelled", "The Board plan was cancelled."));
    },
  };
}

export const startHolomemBoardPlan = startHolomemBoardPlanning;
