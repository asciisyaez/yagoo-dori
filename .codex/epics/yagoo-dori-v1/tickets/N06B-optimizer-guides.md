---
id: N06B
title: Optimizer-backed team guides
status: pending
depends_on: [N03D, N06A]
parallelizable: false
parent_epic: yagoo-dori-v1
---

# N06B: Optimizer-backed team guides

## Acceptance criteria

- [x] Each guide names an exact anchor card, Leader/Outfit, five legal Member slots, and formation order.
- [x] Premium, standard, and viable 4-star-accessible formations come from the optimizer rather than editorial copying.
- [x] Alternatives show replacement loss, affected recipients, timing, investment order, and the reason for the trade.
- [x] Song-specific variants and observed duration-ordered breakpoints are included whenever exact published charts produce a meaningful recommendation change.
- [x] Calculations are useful and reproducible while unsupported precision remains absent.
- [x] The first complete guide is independently checked against evidence and a separate reduced search.

## Verification evidence

- All seven guides were regenerated under schema v5 and methodology `yd-native-guide-1.2.0`.
- Every formation records its all-120-placement order over 30 exact pinned Expert timelines, actual search order count, and exact replacement comparison basis.
- Replacement UI exposes gain, cost, Active cadence, Special duration, recipient changes, and alternate placement.
- Each of 38 published rating-song rows independently audits all 120 placements on its exact note/Special timeline and records source hashes; the page exposes placement-only changes as well as robust team changes.
- Duration-sorted breakpoint detection excludes indeterminate timing ties and publishes the one current meaningful transition (Pekora, Bridal Dream 2:06 to ZenjinruiUsagikakeikaku! 2:21) as an observed exact-chart change, explicitly not a universal duration threshold because note layout and marker timing also change.
- Focused desktop and mobile Playwright coverage verifies the breakpoint and its non-threshold qualification in the production build.
