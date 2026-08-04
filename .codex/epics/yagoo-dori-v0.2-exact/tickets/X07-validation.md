---
id: X07
title: Scope-safe validation and public copy audit
status: done
depends_on: [X06]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X07: Scope-safe validation and public copy audit

## Acceptance criteria

- [x] Negative-path invalidation regressions pass: the exact-optimizer scope
  guards (mutated scope hash; unknown member card; Bloom-map and
  roster-commit drift through their shared guard), both stale-artifact
  detectors in the coverage ledger, the joint-claim contract rejections
  (`formationOrderGloballyCertified` and the result-claim cross-check), and
  a mutation-rejection runner proving the shard/plan verifiers reject at
  least ten distinct artifact corruptions with their specific failure lines,
  with bounded deserialization (byte/depth caps, prototype guard) on both
  verifiers whose valid-path output stays byte-identical. Non-hash mutations
  are re-signed so each specific guard is exercised, and the tests call the
  same exported validation the production initializer calls.
- [x] Public uses of best/optimal/exact/exhaustive/global/certified/proof/
  score are scope-correct and contain no unsupported absolute or joint-global
  claim, enforced by a copy-audit harness (string literals, no-substitution
  templates, template quasis, JSX text, and generated guide/ranking prose
  fields) with an explicit disposition ledger, zero violations, zero
  unresolved occurrences, and a reproducible evidence artifact
  (`data/native/public-copy-audit-v1.json`); the two approved
  claim-narrowing corrections (scope-qualified calculator badge; rendered
  guide `searchCertificate.caveat`) are applied.
- [x] The complete repository verification order passes in exact AGENTS.md
  order, plus the parity rehash (stable digest unchanged), shard/plan
  verifier checks, the mutation-rejection runner, the copy audit, and
  read-only live smoke probes (HTTP status + exactly-once disclaimer) of the
  deployed site.

## Migration note

The former X07 "Certification validation" ticket split on 2026-08-04 into
this X04-independent ticket and X08 "Production certificate validation"
(which re-exercises the certificate machinery against the actual X04
full-scope certificate and performs the certificate-backed copy re-audit and
authorized post-deployment smoke). The former 5% weight split into 3% (X07)
plus 2% (X08); the epic total remains 100%. Every clause of the original
three criteria is carried by this ticket for currently-existing artifacts
and by X08 for the production certificate.
