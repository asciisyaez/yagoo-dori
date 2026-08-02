---
id: N03D
title: Native card rubric, tier snapshot, and global optimizer
status: active
depends_on: [N03B, N03C]
parallelizable: false
parent_epic: yagoo-dori-v1
---

# N03D: Native card rubric, tier snapshot, and global optimizer

## Acceptance criteria

- [ ] Global search evaluates legal five-card teams, eligible Leaders/Outfits, and all 120 formation orders for finalists.
- [x] Card evaluation measures matched-context marginal contribution, synergy ceiling, breadth, and investment efficiency from the evaluator.
- [x] A frozen robust baseline prevents unrelated additions and extreme outliers from arbitrarily rescaling existing cards.
- [x] Confidence, hysteresis, provisional state, and score-delta attribution are implemented and tested.
- [x] Optimizer output includes Leader/Outfit, five cards, order, song context, alternatives, replacement losses, recipients, and timing.
- [x] AppMedia or any other editorial label cannot influence a native score, search result, or tier assignment.

## Verification evidence

- `data/native/relative-utility-model-v1.json` is a schema-validated backstage audit bound to the pinned mechanics commit, exact timing revision, score-kernel rule boundary, all six complete 113-card ranking lenses, and deterministic interval tests.
- The audit retains the unknown Unit Score equation and target resolver as explicit claim boundaries: absolute Live Score stays unavailable, while capped-recipient effects enumerate every legal subset with a guaranteed-minimum central value and maximum upper bound.
- Guide methodology `yd-native-guide-1.2.0` persists chart-timed placement evidence from all 120 orders across 30 pinned Expert timelines, exact five-Special markers, and manual-Perfect note-type coefficients.
- Replacement rows are re-evaluated under the same Leader, chart, progression, and modeled-order basis, with recipient and cadence deltas.
- The full-roster proof search has a sound upper-bound certificate path and exact reduced-roster regressions, but current bounds do not yet finish the 113-card search within the declared runtime budget.
