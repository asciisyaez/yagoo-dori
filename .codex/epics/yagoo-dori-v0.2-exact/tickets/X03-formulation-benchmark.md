---
id: X03
title: Benchmark flat, bounded, and meet-in-the-middle formulations
status: done
depends_on: [X01, X02]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X03: Benchmark solver formulations

## Acceptance criteria

- [x] Flat legal-team enumeration is implemented as the mandatory independent
  baseline and reconciles `126,445,821` legal Member team sets.
- [x] Hybrid branch-and-bound is measured with documented sound bounds and no
  equality pruning.
- [x] Meet-in-the-middle is accepted only if all cross-partition interactions
  are exactly composable; otherwise it is rejected with evidence.
- [x] A checked-in decision record reports hardware, compilers/flags, throughput,
  memory, counts, parity, and projected full-scope cost.

## Current benchmark evidence

`pnpm optimizer:benchmark` generated
`data/native/exact-optimizer-formulation-benchmark-v1.json` on 2026-08-02
using Windows x64, 32 logical CPUs, Node v25.8.0, rustc/cargo 1.94.1, and
default compiler arithmetic with fast-math/reassociation disabled. The flat
baseline counted the declared **126,445,821** legal five-Member sets; its
reduced 20-card probe enumerated 7,616 legal sets at approximately 4.16M
sets/second (enumeration only). The parity-valid compiled evaluator measured
100,000 lower/central/upper cases in 43.06 seconds (2,322 cases/second, zero
mismatches). A deliberately conservative projection of one evaluator call for
each 126,445,821-team × 113-Leader × 30-chart tuple is 428,651,333,190 calls,
or about 51,275 hours at that measured rate; this is a cost projection, not a
claim that future exact aggregation cannot improve it. The measured hybrid
completed a reduced probe in 17.43 seconds with 207 exact leaves and 7,409
strict-bound prunes, but the full-roster budget probe timed out before visiting
a node. A separate Leader-resolution aggregation probe reduced representative
utility calls by 48.67% on 32 reduced teams and two charts, with zero sampled
micro-unit mismatches; it remains a candidate pending the complete mechanic
gate and compiled resolution benchmark. The meet-in-the-middle 2+3 spike is
rejected for certification because the required trigger, target, channel,
Leader/singer, and timing interactions have no proven exact composable state.
The decision record remains a measurement, not a solver selection or
certificate.
