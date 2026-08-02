# Exact aggregation feasibility probe

`pnpm optimizer:aggregation:benchmark` measures a narrow, parity-backed
optimization candidate before it is allowed anywhere near a certifying worker.
The candidate groups Leaders only when both conditions hold:

1. the Leaders are already in the same pinned structural equivalence class; and
2. for the exact chart and selected Member team, their complete resolved Leader
   application graphs are identical.

The representative is evaluated by the unchanged TypeScript native evaluator,
and its lower, central, and upper micro-units are copied to every member of the
group. No score approximation, lossy hash, undocumented recipient resolver, or
floating-point tolerance is involved. A full canonical graph is retained as
the grouping key.

## Current measurement

The checked-in report is
`data/native/exact-optimizer-leader-aggregation-benchmark-v1.json`. On the
declared Windows x64 machine it covered 32 legal teams from the reduced
20-card roster, two Expert chart contexts, and all 113 eligible Leaders. It
compared 7,232 direct utility calls with 3,712 grouped representative calls,
for a 48.67% utility-call reduction. All 1,808 sampled Leader/chart utility
comparisons matched the direct reference values exactly at lower, central, and
upper micro-unit precision. A second deterministic eight-case sample drawn
from the 100,000-case corpus covered all three investment layers, Bloom stages
0–5, singer-unmatched and same-talent collision states; its 904 direct versus
464 grouped calls also had zero mismatches. `parityEligible` is true for these
declared samples only.

The observed 116 resolved groups per team across the two charts means this
probe did not discover extra chart-specific merges beyond the 58 pinned
structural classes. The resolution pass itself still visits the eligible
Leaders and has not yet been compiled or amortized. Therefore this is a
measured candidate, not a full-scope speed claim and not a certificate.

## Gate before reuse

Before integrating this path into full-scope shards, repeat it across the
complete mechanic/trigger/target corpus, every Bloom stage and investment
layer, singer-matched and non-matched charts, identity-sensitive fallback
cases, and independent reduced-roster brute force. Any mismatch keeps the
candidate out of certification. The full plan remains the 864-range,
126,445,821-team artifact described in
[`exact-optimizer-sharding.md`](./exact-optimizer-sharding.md).
