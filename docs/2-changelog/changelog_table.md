# Changelog Table

| Version | Week | Commit Message                  |
| ------- | ---- | ------------------------------- |
| `0.1.10` | 1   | feat(pivot)!: retire the Holomem Board surface; feat(roll-compare): "Should you roll?" unowned-card team comparison |
| `0.1.9` | 1    | fix(trust): pass-2 review repairs — sitemap honesty, board keyboard/a11y, ledger v2, worker startup, migration backup safety, card tier disclosure |
| `0.1.8` | 1    | fix(board): per-talent tree models + orientation; feat: generation-order member listings; fix(trust): external-review triage batch |
| `0.1.7` | 1    | fix(board): Board planner page framing and board SVG geometry |
| `0.1.6` | 1    | feat: calculator search-quality gate closure + cross-run consistency, holomem Board planner and talent-page viewers (T4-T8) |
| `0.1.5` | 1    | feat: member locks, selection evidence, calculator search upgrade, Miko/Suisei guides, fidelity corrections, holomem Board data foundation |
| `0.1.4` | 1    | feat(data): 2026-08 patch intake — two new summer 5★ cards, five new songs, regenerated rankings and guides |
| `0.1.3` | 1    | feat(exact): complete X07 scope-safe validation and public copy audit (v0.2 73%) |
| `0.1.2` | 1    | feat(exact): complete X06 continuation-complete partial-state validation (v0.2 70%) |
| `0.1.1` | 1    | chore: initialize TRIP workflow |

# Changelog Summary

- **v0.1.3 (X07 Scope-Safe Validation + Copy Audit - Week 1, 04-08-2026)**:
  - **Restructure**: X07 split into done X07 (w3) + pending X08 (w2 behind
    X04); all criteria preserved, weights total 100
  - **Hardening**: negative-path regressions via production exports;
    bounded pre-allocation deserialization + 14-case rejection runner on
    the shard verifiers (valid paths byte-identical)
  - **Copy discipline**: 78-occurrence audit with disposition ledger, zero
    violations/unresolved (digest `414cb388…`); badge scope-qualified,
    guide caveat rendered; read-only live smoke green
  - **Status**: X07 done 3/3, v0.2 73%; flags false; nothing pushed/tagged
- **v0.1.2 (X06 Partial-State Validation - Week 1, 04-08-2026)**:
  - **Audit**: Independent takeover audit of the inherited X06 work; evidence
    hash defect fixed, chain regenerated, B2 clamp-identity guard added with
    full parity re-execution at the identical stable digest
  - **Science**: Continuation-complete fixed-Leader partial state designed,
    implemented, and exhaustively suffix-validated (zero mismatches,
    reproducible digest `3dbda663…`); dominance pilot honestly remains
    `attempted:false` with zero credit
  - **Status**: X06 done 6/6, v0.2 70%; flags false; nothing pushed/tagged
  - **Files**: `packages/core/src/exact-optimizer-partial-state.{ts,test.ts}`,
    `scripts/run-exact-optimizer-suffix-validation.mjs`,
    `docs/exact-optimizer-partial-state.md`,
    `data/native/exact-optimizer-suffix-validation-v1.json`, CRs
- **v0.1.1 (TRIP Initialization - Week 1, 03-08-2026)**:
  - **Setup**: Initialized TRIP workflow with docs structure (1-plans,
    2-changelog, 3-code-review, 4-unit-tests, 6-memo)
  - **Documentation**: Generated ARCHI.md documenting the static-site +
    deterministic-core + exact-optimizer architecture
  - **Files Added**: docs/ARCHI.md, docs/ARCHI-rules.md, docs/TRIP-config.md,
    docs/TRIP-checklist.md, docs/2-changelog/changelog_table.md,
    docs/4-unit-tests/TESTING.md
  - **Note**: This is a TRIP workflow-tracking version entry only; the root
    package.json version and the live v0.1.0 tag are bumped separately at
    release time per docs/release.md.
