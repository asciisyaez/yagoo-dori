---
id: N05
title: Complete usable Member-card tier list
status: pending
depends_on: [N02, N03D, N04]
parallelizable: false
parent_epic: yagoo-dori-v1
---

# N05: Complete usable Member-card tier list

## Acceptance criteria

- [x] Tier page shows real tier rows with compact art tiles, not analytic list rows.
- [x] All in-scope real cards appear in the correct source-attributed context.
- [x] Search, rarity, attribute, generation, and context filters persist in the URL.
- [x] Editorial reference tiers and Yagoo-dori calculated tiers cannot be confused.
- [x] Desktop and mobile preserve fast visual scanning.
- [x] Card quick view exposes identity and verified mechanics without fake precision.

## Verification evidence

- Member and Leader/Outfit contexts both map all 113 pinned cards to native ranking snapshots.
- Accessible quick view shows context-appropriate stats and Active/Passive/Special or Leader mechanics.
- Desktop and mobile Playwright quick-view coverage passed on 2026-08-01; ticket remains pending until dependency N03D is done.
