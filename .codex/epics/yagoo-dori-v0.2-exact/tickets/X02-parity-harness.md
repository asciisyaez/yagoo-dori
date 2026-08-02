---
id: X02
title: Generated compiled-kernel parity harness
status: done
depends_on: [X01]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X02: Generated compiled-kernel parity harness

## Acceptance criteria

- [x] The compiled kernel is generated from the same pinned data/IR consumed by
  TypeScript and retains every supported mechanic family.
- [x] Every current card is exercised as Member and Leader/Outfit, including
  Bloom 0–5, triggers, targets, caps, singer matches, identity collisions, and
  legal-team constraints.
- [x] Curated CI, reduced-roster brute force, deterministic metamorphic tests,
  and an offline stratified corpus of at least 100,000 cases pass exactly at
  micro-unit precision.
- [x] Any mismatch sets `certificateEligible=false`; no card-specific exception
  hides a semantic mismatch.

## Current evidence and open gate

`pnpm optimizer:parity:ir` generates the scope-addressed compact IR in
`data/native/exact-optimizer-parity-ir-v1.json`. `pnpm optimizer:parity` checks
all 113 cards in both roles, all observed effect/target/combination families,
and a deterministic 100,000-case legal corpus. The per-case adapter now runs
that corpus through the disposable Rust prototype. An earlier 128-case run
exposed semantic mismatches; after the progression/Bloom, unresolved
Special-trigger, and rounding fixes, the current report records
**100,000/100,000 lower, central, and upper micro-unit matches**. The complete
certification gate is still open because compiled mechanic-state fixtures,
production shard replay, and independent full-scope proof are not complete.

Latest verification:

```text
pnpm optimizer:parity:compiled
compiledOutputCount=100000
mismatchCount=0
certificateEligible=false
```

`pnpm optimizer:parity:diagnostic` isolates component behavior for the first
case. The kernel now materializes low-investment/Bloom progression variants,
the TypeScript rounding boundaries, and the conservative unresolved Special
trigger state. `pnpm optimizer:parity:compiled` reports
`compiledOutputCount=100000`, `mismatchCount=0`, and zero lower/central/upper
micro-unit deltas for every generated case. This is an evaluator pass, not a
certificate pass: compiled mechanic-state fixtures, production shard replay,
and independent full-scope proof remain open, so `certificateEligible` stays
false.

The generated corpus records deterministic coverage of all 113 cards in both
roles, Bloom stages 0–5, all three investment layers, all 30 benchmark charts,
93,390 singer-bearing and 6,610 non-singer chart cases, 9,295 Leader/Member
talent collisions, every five-star count from 0 through 5, and Bloom stages
0–5 for every Member card.
`packages/core/src/exact-optimizer-parity-fixtures.test.ts` exercises every
observed trigger family in passing and failing states plus every target selector
and a genuinely enumerated capped-recipient subset. These supporting fixtures
do not substitute for the complete compiled proof corpus.

`pnpm optimizer:parity:rust-fixtures` runs the disposable Rust unit fixture
suite and records `data/native/exact-optimizer-rust-mechanic-fixtures-v1.json`.
It currently passes trigger families in passing/failing states, all target
selectors, capped recipient enumeration, base/override Active combinations,
and JavaScript-compatible signed rounding. This is supporting prototype
evidence; it does not make the Rust directory production code or create a
roster certificate.

`pnpm optimizer:parity:reduced` independently enumerates 56 legal teams and
224 Leader/team cases, compares every lower/central/upper result against the
TypeScript reference, and agrees on the canonical winner with zero mismatches.
The checked-in report is explicitly `parityEligible=true` for that reduced
fixture but `certificateEligible=false`; it is not evidence for the unrestricted
113-card scope.

`pnpm optimizer:metamorphic` records passing reduced-roster checks for Member
permutation, equivalent Leader classes, deterministic shard ordering,
independent enumeration versus branch-and-bound, exact/pruned reconciliation,
and strict upper-bound handling. A true parallel/resume artifact replay is
still open in X04.
