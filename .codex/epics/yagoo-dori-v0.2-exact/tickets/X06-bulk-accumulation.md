---
id: X06
title: Guarded bulk accumulation and dominance feasibility
status: done
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
- [x] A continuation-complete fixed-Leader partial state is proven and then
  exhaustively suffix-validated on a reduced roster before any dominance
  frontier receives timing or pruning credit. (Continuation-completeness is
  proven at the declared merge boundaries — formation identity and
  accumulator arithmetic — per the ratified D-7 amendment in
  `docs/1-plans/F_0.1.2_x06-continuation-complete-partial-state.plan.md`;
  no dominance frontier was built and none received timing or pruning
  credit.)

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

`pnpm optimizer:dominance:feasibility` records the formal Phase-7 disposition.
The continuation-complete fixed-Leader partial state is now designed
(`docs/exact-optimizer-partial-state.md`), implemented
(`packages/core/src/exact-optimizer-partial-state.ts`), and exhaustively
suffix-validated on the pinned reduced scope by
`pnpm optimizer:suffix:validation`: 161,280 state-resumption comparisons,
633,660 mutation checks, and 2,321,280 accumulator boundary comparisons with
zero mismatches, stable digest `3dbda663…` reproduced across two complete
runs. Zero distinct-history collision pairs were observed, so no merge rule
was exercised: resumption soundness is proven, merge-rule soundness is not
claimed. The pilot remains `attempted:false` with zero dominance prunes and
zero full-scope projection credit — the strict-loss prune proof with complete
accounting is the outstanding reopening requirement, and the identity-like
key merges nothing, so a frontier cannot earn pruning credit without a new
versioned, proven merge relation.
