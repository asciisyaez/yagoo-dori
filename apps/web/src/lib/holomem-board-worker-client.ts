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
  const worker = new Worker(new URL("../workers/holomem-board.worker.ts", import.meta.url), {
    type: "module",
    name: "yagoo-dori-holomem-board",
  });
  let settled = false;
  let rejectTask: ((reason: unknown) => void) | null = null;

  const cleanup = (): void => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };

  const result = new Promise<HolomemBoardResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<HolomemBoardWorkerResponseMessage>) => {
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
    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new HolomemBoardWorkerError("worker-failed", "The Board plan could not finish."));
    };
    const message: HolomemBoardWorkerRequestMessage = { type: "calculate", payload: request };
    worker.postMessage(message);
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
