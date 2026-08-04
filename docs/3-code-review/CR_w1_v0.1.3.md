# Code Review: X07 Split: Scope-Safe Validation, Public Copy Audit, and X08 Carve-Out

**Review Date**: 2026-08-04  
**Version**: 0.1.3  
**Files Reviewed**:

- `.codex/epics/yagoo-dori-v0.2-exact/epic.md`
- `.codex/epics/yagoo-dori-v0.2-exact/status.json`
- `.codex/epics/yagoo-dori-v0.2-exact/tickets/X07-validation.md`
- `.codex/epics/yagoo-dori-v0.2-exact/tickets/X08-certificate-validation.md`
- `apps/web/e2e/guides.spec.ts`
- `apps/web/e2e/team-calculator.spec.ts`
- `apps/web/pages-e2e/pages-static.spec.ts`
- `apps/web/src/app/guides/[slug]/page.tsx`
- `apps/web/src/components/team-calculator.tsx`
- `data/native/public-copy-audit-v1.json`
- `docs/1-plans/F_0.1.3_x07-validation-split.plan.md`
- `package.json`
- `packages/core/src/exact-optimizer-coverage.test.ts`
- `packages/core/src/exact-optimizer-coverage.ts`
- `packages/core/src/exact-optimizer-scope.test.ts`
- `packages/core/src/exact-optimizer-scope.ts`
- `packages/core/src/team-calculator-contract.test.ts`
- `scripts/copy-audit-ledger.json`
- `scripts/lib/read-bounded-json.mjs`
- `scripts/run-copy-audit.mjs`
- `scripts/run-live-smoke.mjs`
- `scripts/test-exact-verifier-rejections.mjs`
- `scripts/verify-exact-shard-plan.mjs`
- `scripts/verify-exact-shards.mjs`

**Plan**: `docs/1-plans/F_0.1.3_x07-validation-split.plan.md`

---

## Executive Summary

The change separates scope-safe X07 validation from certificate-dependent X08, adds negative-path verifier coverage and bounded JSON deserialization, introduces a deterministic public-copy audit, and narrows two public claims. Three findings were raised during review; all were addressed and re-verified with no overrides or open findings.

APPROVED

---

## Changes Overview

X07 now depends only on X06 and covers currently executable validation, while X08 remains pending behind blocked X04. The implementation adds production-path scope and stale-artifact regressions, a 14-case verifier rejection runner, bounded JSON handling, a public-copy disposition ledger and evidence artifact, read-only live smoke checks, and the two plan-authorized UI claim corrections.

The final project state records X07 as done at `.codex/epics/yagoo-dori-v0.2-exact/tickets/X07-validation.md:4`, with all three criteria checked at lines 14–38. X08 remains pending, certificate state remains not eligible, and the historical 864-shard plan remains unexecuted.

---

## Findings

### Critical Issues

#### Generated-guide copy audit omitted rendered song-title copy

- **Original location**: `data/generated/native-guides.json:2070`, rendered by `apps/web/src/app/guides/[slug]/page.tsx:503`
- **Disposition**: Addressed
- **Resolution**: The audit now recursively discovers guide prose fields, including `songTitle`, at `scripts/run-copy-audit.mjs:149-182`. The “Do my best!” occurrence is explicitly classified at `scripts/copy-audit-ledger.json:3-5` and recorded at `data/native/public-copy-audit-v1.json:203-211`.
- **Final evidence**: 78 occurrences, zero violations, zero unresolved entries, and stable digest `414cb388dcf97898c0ed15d733c5105bb137b9956e1ab4bee12723c1dd1550da` at `data/native/public-copy-audit-v1.json:784-789`.

### Major Issues

#### Byte cap was enforced only after allocating the entire input

- **Location**: `scripts/lib/read-bounded-json.mjs:37-45`
- **Disposition**: Addressed
- **Resolution**: `statSync(filePath).size` now rejects oversized artifacts before `readFileSync` allocation. The post-read check remains as defense in depth.

#### Certified calculator badge omitted the benchmark scope

- **Location**: `apps/web/src/components/team-calculator.tsx:92-97`
- **Disposition**: Addressed
- **Resolution**: The badge now reads “All legal teams from your owned roster checked across the 30-chart benchmark,” naming both required scopes. The wording is pinned in `apps/web/e2e/team-calculator.spec.ts:183-190`.

### Minor Issues

None.

### Suggestions

None.

---

## Checklist

- [x] 1. Functional Requirements — Passed
- [x] 2. Code Quality — Passed
- [x] 3. Architectural Compliance — Passed
- [x] 4. Exactness & Claim Discipline — Passed
- [x] 5. Evidence & Determinism — Passed
- [x] 6. Scope & Product Safety — Passed
- [x] 7. Error Handling — Passed
- [x] 8. Security — Passed
- [x] 9. Performance — Passed

---

## Verdict

**APPROVED**

All findings were addressed without overrides. The final verification evidence reports clean lint and typecheck, full suites green, 59+4 E2E tests, a 6,222-file Pages export, 14/14 rejection cases, a reproducible 78-occurrence copy audit with zero violations or unresolved entries, unchanged `320da206…` parity rehash, and passing read-only live smoke. X07 is complete at 73% overall v0.2 progress; X08 remains correctly deferred behind the blocked X04 cost gate.

