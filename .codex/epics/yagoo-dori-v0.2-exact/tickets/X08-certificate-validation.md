---
id: X08
title: Production certificate validation
status: pending
depends_on: [X04]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X08: Production certificate validation

## Acceptance criteria

- [ ] Certificate scope invalidation, stale hashes, bounded deserialization,
  timeout output, Oshi/Bloom/ownership/chart changes, and conditional-order
  regressions pass when re-exercised against the actual X04 full-scope
  certificate artifacts (not only the reduced-scope fixtures covered by
  X07).
- [ ] Public uses of best/optimal/exact/exhaustive/global/certified/proof/
  score are re-audited for scope-correctness against the certificate-backed
  claims before any certificate-derived wording ships, with the copy-audit
  harness extended to the new claim surfaces and zero violations.
- [ ] The complete repository verification order plus parity, deterministic,
  verifier, and explicitly authorized post-deployment live smoke checks pass
  with the production certificate integrated.

## Migration note

Created 2026-08-04 by splitting the former X07 "Certification validation"
ticket: the X04-independent validation stayed in the re-scoped X07
(weight 3); this ticket holds the certificate-dependent remainder
(weight 2). The former 5% weight split 3% + 2%; the epic total remains
100%. This ticket cannot start until X04 produces the full-scope
certificate; it remains pending and earns no progress until then.
