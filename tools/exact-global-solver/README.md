# Exact-search prototype

This directory is a **research prototype**, not a production optimizer and
not a global-optimum certificate. It is kept to make compiled-kernel
experiments reproducible while the exact evaluator is being ported.

The Rust evaluator does not yet implement every `formation-evaluator` rule
(including all unresolved-trigger and recipient-resolution semantics). Its
output is therefore deliberately marked `certificateEligible: false` and
must not be copied into rankings, guides, or calculator results. A future
solver may be promoted only after differential tests agree with
`evaluateNativeCentralUtility` across the complete mechanic catalog and a
full-roster run reconciles every legal team set.

The prototype comparator now rounds to the canonical six-decimal micro-unit
boundary and does not use an epsilon for ties or pruning. A generated adapter
now emits lower, central, and upper values and matches all 100,000 cases in the
deterministic offline corpus exactly. This is an evaluator gate only: the full
mechanic-state corpus, metamorphic tests, and independent full-scope certificate
replay remain open.

The generated parity IR and deterministic corpus are maintained by
`pnpm optimizer:parity:ir` and `pnpm optimizer:parity`. A disposable per-case
adapter is wired for differential diagnostics and records its sample parity
report separately. No certificate claim is available until the complete parity
gate and a declared-scope proof pass.

Generate the local kernel with:

```text
node --import tsx/esm tools/exact-global-solver/generate.mjs
```

Build/run output remains local evidence and is ignored by Git.
