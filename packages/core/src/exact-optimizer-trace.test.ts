import { describe, expect, it } from "vitest";

import {
  assessExactCompressionAdmissibility,
  compileExactArithmeticTrace,
  compileExactStateRuns,
  replayExactStateRuns,
} from "./exact-optimizer-trace";

describe("exact arithmetic trace compression", () => {
  it("replays repeated state values in the original IEEE-754 addition order", () => {
    const trace = compileExactArithmeticTrace(6);
    const states = Uint32Array.from([1, 1, 2, 2, 2, 1]);
    const runs = compileExactStateRuns(states);
    const values = new Map([[1, 0.1], [2, 0.2]]);
    const expected = [0.1, 0.1, 0.2, 0.2, 0.2, 0.1].reduce(
      (total, value) => total + value,
      0,
    );

    expect(
      replayExactStateRuns(trace, runs, (stateId) => values.get(stateId)!),
    ).toBe(expected);
    expect(runs).toEqual([
      { stateId: 1, startInclusive: 0, endExclusive: 2, multiplicity: 2 },
      { stateId: 2, startInclusive: 2, endExclusive: 5, multiplicity: 3 },
      { stateId: 1, startInclusive: 5, endExclusive: 6, multiplicity: 1 },
    ]);
  });

  it("rejects multiplicity and parallel reductions before any compressed evaluation", () => {
    const trace = compileExactArithmeticTrace(2);
    const states = Uint32Array.from([7, 7]);
    expect(
      assessExactCompressionAdmissibility({
        trace,
        stateIds: states,
        stateCapturesAllInputs: true,
        preservesSourceOrder: true,
        reduction: "multiplicity",
      }),
    ).toMatchObject({ admissible: false, mode: "uncompressed-fallback" });
    expect(
      assessExactCompressionAdmissibility({
        trace,
        stateIds: states,
        stateCapturesAllInputs: true,
        preservesSourceOrder: true,
        reduction: "parallel",
      }).reasons,
    ).toContain("reassociation-forbidden:parallel");
  });
});
