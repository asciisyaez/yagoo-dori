# Exact optimizer performance decision

**Decision:** do not launch the full 864-shard plan.

The selected execution contract is **C: hybrid team sieve → fixed-Leader
bound → compressed exact trace**. It is selected for its explicit, sound B0/B1
stages and trace-preserving B2 evaluation—not because the pilot claims it is
the fastest possible formulation. Its semantic gate is separate:
100,000 deterministic complete inputs match the forced-uncompressed evaluator
at lower/central/upper canonical micro-units with zero trace fallbacks.

The current compact evidence is in:

- [`data/native/exact-optimizer-coverage-v1.json`](../data/native/exact-optimizer-coverage-v1.json)
- [`data/native/exact-optimizer-reduced-proof-v1.json`](../data/native/exact-optimizer-reduced-proof-v1.json)
- [`data/native/exact-optimizer-performance-pilot-v1.json`](../data/native/exact-optimizer-performance-pilot-v1.json)
- [`data/native/exact-optimizer-cost-model-v2.json`](../data/native/exact-optimizer-cost-model-v2.json)
- [`data/native/exact-optimizer-leader-root-bounds-v1.json`](../data/native/exact-optimizer-leader-root-bounds-v1.json)

## Measured pilot

The deterministic stratified pilot has 32 shards (four talent-prefix areas,
seven- and eight-talent shard sizes, trigger/root-bound q25 and q75 Leader
anchors, matched and unmatched singer charts, and easy/high-parameter plus
hard/low-parameter seeds). It covers 52,160 legal team sets and 104,320 flat
Leader×team×chart states. A (compressed team-first enumeration), B
(fixed-Leader-first branch-and-bound), and C produce the same canonical winner
for every shard; their trace fallback counts are zero.

For C, the pilot observed 52,160 B0 entrants / 34,655 strict prunes / 17,505
survivors; 17,505 B1 entrants / 6,831 prunes / 10,674 survivors; and 10,674
B2 entrants / 10,374 prunes / 300 survivors. It made 21,412 exact central and
21,412 interval evaluations. Its shard p50/p95 throughputs were 1,437.20 /
1,637.33 teams/s, 300.01 / 403.34 Leader-team pairs/s, 600.03 / 806.67
Leader-team-chart states/s, and 64,168.38 / 87,727.09 trace segments/s. Peak
RSS was 385,310,720 bytes. Native branch-and-bound does not expose a
per-state-segment counter, so B reports that metric as unavailable.

The C p95 timings used by the cost model are 0.011830 ms per team-once
compilation, 0.592974 ms per four-Leader B0 team sieve, 0.151231 ms per
fixed-Leader B1 pair, and 0.302541 ms per compressed exact state. Leader
conditioning and exact-trace evaluation are one kernel call, so the model
records their separate sub-call timing as unavailable rather than inventing a
split. The Rust `certification` profile built in 93.436 ms on the measured
host; it remains research-only.

Candidate-only replay was measured on the same 32-logical-CPU host: 8 workers
gave 4.343x speedup (54.29% efficiency), 16 gave 5.224x (32.65%), and the
actual 32-worker run gave 4.650x (14.53%). Each worker retains serial
source-order trace arithmetic. Measured single-thread elapsed times are A =
26.155 s, B = 5.272 s, and C = 36.942 s. B is 4.961x faster than A; C
sustains 0.708x A's throughput (or is 1.412x slower than A by elapsed time); C takes
approximately 7.007x B's elapsed time. These are whole-workload comparisons,
not per-state kernel-speed claims.

## Cost model and no-go gate

The declared scope contains 126,445,821 legal Member teams, 113 actual
Leader/Outfit IDs, and 30 aggregate charts: 428,651,333,190
Leader×team×chart evaluations before any valid pruning credit. The selected
stratified-p95, no-pruning minimum is 36,624.16 serial core-hours. It excludes
full 113-Leader B0 scaling because only a four-Leader B0 bundle was measured;
the model labels that work unavailable instead of extrapolating it.

With a 25% contingency, the recorded wall estimates are 45,780.20 hours at
one worker, 10,540.99 at eight, 8,763.14 at sixteen, and 9,845.99 at thirty-two
(also the actual candidate-worker count). The full 113-class root ledger
records zero strict root prunes against its bounded incumbent, so the model
claims no root-pruning credit. These measurements are far beyond the 72-hour /
1,000-core-hour offline gate.

This is a no-go decision, not a request to weaken the objective. The full plan
remains unevaluated, `certificateEligible` stays false, and no public ranking
or deployment behavior changes.

## What could reopen the decision

A new full-run proposal must first demonstrate all of the following on the
same pinned scope:

1. a material measured reduction with exact trace and micro-unit parity;
2. whole-Leader B0/B1/B2 bounds that never mix Leader components;
3. actual Outfit-pair accounting and equality-survivor handling at B3;
4. serial and independent-worker replay evidence; and
5. a refreshed cost model below the declared wall-time and core-hour gates.

Until then, use the full-trace gate, full root ledger, reduced proof, and
stratified pilot only for regression and architecture work. They do not certify
a global optimum.
