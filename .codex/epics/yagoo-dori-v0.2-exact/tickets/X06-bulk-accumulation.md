---
id: X06
title: Guarded bulk accumulation and dominance feasibility
status: active
depends_on: [X05]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X06: Guarded bulk accumulation and dominance feasibility

## Acceptance criteria

- [x] The complete 1,000,000-case synthetic boundary corpus and 100,000-case
  real corpus have stable evidence digests, zero false certificates, and zero
  comparison mismatches while runtime metadata remains non-authoritative.
- [x] B2 exposes only a certified central value for strict-loss pruning and
  promotes equality, finalists, and fallbacks to B3.
- [x] Ordered B3, A, B, and C share an 8-team × 4-Leader × 30-chart workload
  with deterministic warm-up plus five-repeat p50/p95/worst/CPU/RSS evidence.
- [x] The p95 no-pruning cost model records raw and 25%-contingency core-hours,
  candidate-worker wall bounds, missed 99.9%/15x/8x targets, and no full-run
  authorization.
- [x] Phase 7 records either a reduced exhaustive dominance proof or a concrete
  pre-pilot kill criterion with `attempted:false`, zero pruning credit, and no
  frontier metrics.
- [ ] A continuation-complete fixed-Leader partial state is proven and then
  exhaustively suffix-validated on a reduced roster before any dominance
  frontier receives timing or pruning credit.

## Current implementation evidence

`pnpm optimizer:parity:bulk:rehash` migrated the valid interrupted duplicate
full artifact without rerunning it. Its stable evidence digest anchors the
identical primary and duplicate corpus outcomes; their legacy volatile report
hashes and separate runtime observations remain in the artifact. The primary
run's ordered/B3/B2 timings are 52,363.324 / 36,345.890 / 24,154.840 ms.

`pnpm optimizer:architecture:rebaseline` records one deterministic warm-up and
five serial measurements per ordered B3/A/B/C path over the same 960 states.
The 1-worker record is repeated timing; 2/4/8/16/32-worker records are
explicitly single-run deterministic-parity replays and receive no projection
credit. All winner/tie digests agree.

`pnpm optimizer:bulk:performance` retains the scope-identical stratified-p95
no-pruning bound: 36,624.157 raw core-hours and 45,780.196 core-hours with a
25% contingency. Its p95 wall bounds are 45,780.196 hours (1 worker),
10,540.989 (8), 8,763.144 (16), and 9,845.993 (32), so the <=800 raw-core-hour
and <=72-hour p95 gates fail. Full B3 (99.287%), B2 (99.605%), 15x B2, and 8x
end-to-end targets are all missed. `fullRunAuthorized=false` and
`certificateEligible=false` remain mandatory.

`pnpm optimizer:dominance:feasibility` produces the required formal Phase-7
stop. No frontier is built because no continuation-complete state is proven to
preserve fixed-Leader resolution, formation/progression/trigger suffixes,
source-order binary64 enclosures, and B3 tie promotion. The artifact reports
`attempted:false`, zero dominance prunes, and zero full-scope projection credit.
