---
id: X06
title: Exact certification validation and public copy audit
status: pending
depends_on: [X04, X05]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X06: Certification validation

## Acceptance criteria

- [ ] Certificate scope invalidation, stale hashes, bounded deserialization,
  timeout output, Oshi/Bloom/ownership/chart changes, and conditional-order
  regressions pass.
- [ ] Public uses of best/optimal/exact/exhaustive/global/certified/proof/score
  are scope-correct and contain no unsupported absolute or joint-global claim.
- [ ] The complete repository verification order plus parity, deterministic,
  verifier, and authorized live smoke checks pass.
