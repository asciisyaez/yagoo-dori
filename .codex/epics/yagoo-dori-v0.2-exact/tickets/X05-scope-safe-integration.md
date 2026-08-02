---
id: X05
title: Scope-safe optimizer and conditional-order integration
status: pending
depends_on: [X01, X02, X04]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X05: Scope-safe integration

## Acceptance criteria

- [ ] Full-roster certificate matching requires an exact scope hash tuple.
- [ ] Arbitrary owned rosters and guide variants remain exhaustive only when
  their declared scope is exhausted, otherwise bounded and visibly disclosed.
- [ ] Result contracts expose claim, certificate kind, scope/objective hashes,
  counts, gap, evaluator/arithmetic versions, and formation-order state.
- [ ] All 120 orders are evaluated for every aggregate-optimal tied formation and
  reported as conditional timing recommendations.
