---
id: E02
slug: yagoo-dori-v0.2-exact
created: 2026-08-02
status: executing
parent_epic: yagoo-dori-v1
---

# Yagoo-dori v0.2 exact certification

## Objective

Build a separately scoped, certifiable exact optimizer without changing the
already-live v0.1 product or weakening its mechanics, benchmark, Bloom,
recipient, trigger, or rounding assumptions.

## Claim boundary

The TypeScript native evaluator remains the reference implementation. The Rust
code under `tools/exact-global-solver` is a disposable research prototype until
the complete parity gate passes. A candidate, timeout, FEASIBLE, best-known, or
bounded result is never labelled optimal, exact, global, or certified.

The aggregate certificate proves only the exact input tuple named by its scope
hash. It does not prove arbitrary owned rosters, Bloom stages, Oshi constraints,
guides, songs, investment lenses, or formation orders. Formation order remains a
conditional second-stage result unless a future single-objective method searches
the joint team/Leader/order space.

## Dependency graph

```text
X01 specification + arithmetic ──► X02 complete parity ──► X03 formulation benchmark
                                                                  │
                                                                  ▼
                                                        X05 checkpointed performance architecture
                                                                  │
                                                                  ▼
                                                   X06 guarded bulk accumulator and no-go evidence
                                                                  │
                                          ┌───────────────────────┴──────┐
                                          ▼                              ▼
                    X07 scope-safe validation + copy audit   X04 sharded certificate execution and verifier
                                                                         │
                                                                         ▼
                                                          X08 production certificate validation
```

The former single X07 validation ticket split on 2026-08-04: the
X04-independent validation (machinery regressions against reduced-scope
artifacts, public copy audit, verification order + read-only live smoke)
became the new X07 (weight 3, depends only on X06), while the
certificate-dependent remainder moved to X08 (weight 2, depends on X04).
The former 5% X07 weight split 3% + 2%; the epic total remains 100%.

## Non-goals

- Rewriting v0.1 rankings or guides solely because a compiled accelerator exists.
- Inventing an absolute Live Score equation or deterministic capped-recipient
  resolver that public evidence does not support.
- Calling the Rust prototype production code because it compiles.
- Changing GitHub Pages settings, repository variables, visibility, tags, or
  deployment state.

## Acceptance gate

The epic is complete only after the pinned tuple/objective, exact micro-unit
comparator, complete parity corpus, reduced-roster brute-force agreement,
serial/parallel determinism, legal-space reconciliation of `126,445,821`,
content-addressed shard artifacts, independent verifier, conditional order
record, public copy audit, and full repository verification chain all pass.

If the full proof exceeds the declared offline budget, retain the measured
candidate and `certificateEligible=false`, record the bottleneck, and choose the
next formulation without weakening the model.
