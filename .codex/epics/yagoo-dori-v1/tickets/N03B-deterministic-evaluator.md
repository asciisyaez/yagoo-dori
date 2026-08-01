---
id: N03B
title: Deterministic team and skill evaluator
status: done
depends_on: [N03A]
parallelizable: false
parent_epic: yagoo-dori-v1
---

# N03B: Deterministic team and skill evaluator

## Acceptance criteria

- [x] Investment layers cover one-copy maximum, low investment, and duplicate-enabled ceiling without conflating them.
- [x] Legal teams contain exactly one Leader/Outfit and five Member cards with unique talents.
- [x] Compiled Leader, Passive, Active, Special, Connect, target, timing, stacking, cap, and formation-order rules are evaluated.
- [x] All 120 Special orders are enumerable and expected-value simulation is deterministic under a fixed seed.
- [x] Output includes component-level contribution and recipient breakdowns rather than a single opaque number.
- [x] Reduced real fixtures match a separately implemented brute-force reference.
