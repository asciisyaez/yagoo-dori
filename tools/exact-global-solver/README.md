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

Generate the local kernel with:

```text
node --import tsx/esm tools/exact-global-solver/generate.mjs
```

Build/run output remains local evidence and is ignored by Git.
