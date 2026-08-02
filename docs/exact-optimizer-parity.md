# Exact optimizer parity harness

The parity harness is deliberately separate from the public calculator. The
TypeScript native evaluator remains the reference implementation.

1. `pnpm optimizer:parity:ir` generates a compact, scope-addressed IR from the
   same pinned mechanics/public data consumed by TypeScript. It retains card
   identity, progression/Bloom inputs, all skill applications, channels,
   combination modes, effect families, triggers, target selectors, caps, Leader
   applications, and catalog relationships.
2. `pnpm optimizer:parity` validates the IR roster and mechanic coverage and
   generates a deterministic 100,000-case legal formation/chart/investment/Bloom
   corpus. Its report records the scope hash, IR hash, case hash, generator
   version, and hardware.
3. The current report is intentionally not eligible for certification. The
   disposable Rust prototype now exposes lower/central/upper per-case output
   and matches the full 100,000-case corpus exactly, but the complete
   mechanic/metamorphic suite and independent full-scope proof remain open. A
   parity pass is evidence of evaluator agreement, not a pass of the complete
   gate and not a certificate.

The compiled adapter compares final lower, central, and upper integer
micro-units exactly against TypeScript. Any mismatch keeps
`certificateEligible=false`; epsilon-based acceptance or card-specific fixes are
not allowed.

## Current mismatch diagnosis

`pnpm optimizer:parity:diagnostic` records a component-level comparison for the
first sampled case in `data/native/exact-optimizer-parity-diagnostic-v1.json`.
The shared kernel now materializes low-investment and Bloom progression
variants, ports the reference rounding boundaries, and preserves the unresolved
Special-trigger minimum semantics. `pnpm optimizer:parity:compiled` now reports
`mismatchCount=0` and zero lower/central/upper deltas across all 100,000 cases.
This is a meaningful evaluator pass, not the complete gate: all mechanic-state
fixtures, metamorphic checks, and independent full-scope brute-force/certificate
replay remain open.

`pnpm optimizer:parity:reduced` is the independent reduced-roster check. It
enumerates 56 legal five-Member teams, evaluates 224 Leader/team cases, and
compares every lower/central/upper result plus the canonical winner against the
TypeScript reference. The current report has zero mismatches and
`parityEligible=true` for that fixture only; it deliberately remains
`certificateEligible=false` for the unrestricted scope.

`pnpm optimizer:metamorphic` records the reduced-roster invariants for Member
permutation, equivalent Leader classes, sharded versus unsharded ordering,
deterministic execution order, independent enumeration versus branch-and-bound,
and strict upper-bound reconciliation. It does not claim that the production
full-roster solver is already resumable or parallel-certificate safe.

The complete scope traversal contract is separate from this evaluator gate:
`pnpm optimizer:shards:plan` produces 864 deterministic ranges covering the
independently counted 126,445,821 legal Member teams, and
`pnpm optimizer:shards:plan:verify` validates the ranges and resume tokens. The
plan is intentionally unevaluated and cannot be called a proof.

`pnpm optimizer:aggregation:benchmark` probes an exact, chart-specific Leader
resolution cache on a declared reduced sample. Its current report has zero
micro-unit mismatches, but resolution cost and complete mechanic coverage must
be measured before the candidate can be used by a certifying shard worker.
