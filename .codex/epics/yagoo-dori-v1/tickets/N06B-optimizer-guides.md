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
- [ ] Song-specific variants and duration breakpoints are included whenever they change the optimum.
- [x] Calculations are useful and reproducible while unsupported precision remains absent.
- [x] The first complete guide is independently checked against evidence and a separate reduced search.

## Verification evidence

- All seven guides were regenerated under schema v4 and methodology `yd-native-guide-1.2.0`.
- Every formation records the modeled order, 30-chart/14-layout timing coverage, actual search order count, and exact replacement comparison basis.
- Replacement UI exposes gain, cost, Active cadence, Special duration, recipient changes, and alternate placement.
- Focused core tests (38) and desktop/mobile guide Playwright checks passed on 2026-08-01.
- Exact timed-chart breakpoints remain unchecked because the pinned dataset contains zero note/Special-marker timelines.
