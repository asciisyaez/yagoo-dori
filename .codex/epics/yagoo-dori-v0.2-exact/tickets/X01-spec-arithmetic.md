---
id: X01
title: Versioned optimizer specification and canonical arithmetic
status: done
depends_on: []
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X01: Versioned optimizer specification and canonical arithmetic

## Acceptance criteria

- [x] `docs/exact-optimizer-spec.md` defines the complete input tuple, hashes,
  aggregate objective, separate conditional order claim, and canonical tie-break.
- [x] Signed six-decimal micro-units and outward-rounded integer bounds are
  implemented without epsilon-based pruning or tie collapsing.
- [x] Comparator and rounding tests cover positive/negative half units,
  boundaries, interval tie-breaks, complete ties, and upper-bound equality.
- [x] A canonical scope manifest can be hashed and independently re-read.

## Test plan

Evidence: `pnpm optimizer:scope`, the focused arithmetic/scope Vitest tests,
`pnpm --filter @yagoo-dori/core typecheck`, and `pnpm data:validate` all pass.
