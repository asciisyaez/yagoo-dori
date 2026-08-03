---
id: X07
title: Exact certification validation and public copy audit
status: pending
depends_on: [X04, X06]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X07: Certification validation

## Acceptance criteria

- [ ] Certificate scope invalidation, stale hashes, bounded deserialization,
  timeout output, Oshi/Bloom/ownership/chart changes, and conditional-order
  regressions pass.
- [ ] Public uses of best/optimal/exact/exhaustive/global/certified/proof/score
  are scope-correct and contain no unsupported absolute or joint-global claim.
- [ ] The complete repository verification order plus parity, deterministic,
  verifier, and authorized live smoke checks pass.

## Migration note

This is the former generic validation/public-copy-audit ticket. It moved from
X06 to X07 when guarded bulk accumulation became the active X06 research
ticket. The weights split the former 10% X06 allocation into 5% X06 and 5% X07;
the epic total remains 100%.
