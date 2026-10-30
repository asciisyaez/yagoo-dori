# Halloween meta intake — 2026-10-30

## Source and scope

The [QualiArts announcement reproduced by GameBiz](https://gamebiz.jp/news/434762) and [AppMedia banner page](https://appmedia.jp/hololive-dreams/80524675) identify five Halloween ★5 Members. The gacha runs October 29 11:00 through November 6 10:59 JST; the point rally runs October 29 12:00 through November 4 19:59 JST. The publisher names six event songs, including `KaienSpectacle`; no individual song release windows are inferred. The first 10-pull is free on the standard banner, excluding the selectable-pickup version.

Pinned public structured sources: [ENG 70cbc0a485dc7b332f80404dd060254689e52450](https://github.com/HolodoriDB/holodori-db-eng-diff/tree/70cbc0a485dc7b332f80404dd060254689e52450), [JPN e004fb6b8fc9aafefbde526d8e698a29c66818b5](https://github.com/HolodoriDB/holodori-db-jpn-diff/tree/e004fb6b8fc9aafefbde526d8e698a29c66818b5), master version `1aba922e9cd282db2396b19d220524b46e7ac10459c5ffb3c1b6f6d4eb9f550d`. Retrieval date: 2026-10-30. The previous 142 normalized Member records and mechanics records are byte-equivalent as data objects; five ★5 cards are added, for 147 supported 4★/5★ cards and 54 talents.

| Talent | Card | Max-Bloom P / T / S | Standard Member tier / rank |
| --- | --- | --- | --- |
| Natsuiro Matsuri | Wolf's Sugary Trick | 7682 / 6803 / 11380 | B / 73 |
| Vestia Zeta | Heartbeat Clinic | 7682 / 11380 / 6803 | B / 89 |
| Nerissa Ravencroft | Bewitching Elixir | 11145 / 6947 / 7828 | A / 45 |
| Juufuutei Raden | Noble Elegance | 7828 / 11145 / 6947 | B / 83 |
| Todoroki Hajime | Jiangshi Midnight Waltz | 7221 / 10909 / 7844 | B / 92 |

All five max-Bloom stat triples and maximum-level Active, Passive, Special, and Leader effects agree with the corresponding AppMedia and Game8 pages (AppMedia 80518837, 80518819, 80518846, 80524516, 80524519; Game8 839033, 839032, 839031, 839029, 839030). The effects use existing attribute-count and ReGLOSS-count trigger families; no newly introduced singer-conditional trigger requires a benchmark refreeze. All 147 cards compile with no unresolved mechanic references.

Public AppMedia 300×300 card icons and Game8 2100×1165 full illustrations are stored locally without upscaling, with source and hash records in `data/generated/card-art-manifest.json`. Five images and their embedded attribute badges were inspected; all 147 asset pairs and previews pass validation. Existing Board catalog tables and graph rules are unchanged, so the Board model changes only its mechanics-file hash and model hash.

## Rankings and charts

Native snapshot `2026-10-30-yd-native-2.1` reuses the six frozen launch baselines and the 30-chart historical benchmark. Existing cards have zero Member/Outfit model-index changes and zero tier changes. Five new entries per lens shift 510 existing ranks across six lenses; the attributed changelog contains 540 changes including 30 new entries. These are relative model results, not certified global optima or absolute Live Scores.

The new structured source contains 227 songs and 908 chart rows; all 908 omit current chart hashes and normal-note counts. The public timing revision endpoint returned HTTP 403 on one check and HTTP 404 during the intake orchestrator. `data/native/current-chart-availability-v1.json` records every current key as timing-unavailable, including 96 new keys; all 812 historical-scoring keys remain present and their aggregate combo counts agree. Current hashes are never inferred from historical hashes. The calculator and guide scoring input remains pinned to the historical 203-song / 812-chart revision `f7428d4092d57b34311f030e00ff46e7dbbc29e8`. The six event-song titles and IDs are presented as metadata, without claims about chart timing or individual release windows.

The October 19 Kaela/Botan P/T category disagreement remains in `data/review-queue.json`; the new five cards have no such observed stat disagreement. X04 exact certification remains blocked: the 147-card scope hash is `002d1b455f75bbf35c068103c6ca1403053c2eb8135e4e1dde7ae9958c243106`, with 470,341,677 legal Member teams, and old scope-specific parity, bounds, and cost evidence cannot authorize full shards.

## Guides and validation

All 36 existing guides were regenerated first, followed by five new exact-card guides and a complete projection. The 41 guides contain 123 formations and reference 138 distinct cards and 87 distinct Leader sources; their projection contains 131 exact and 25 explicitly unavailable chart contexts (128,922 exact timed events). Nerissa’s Standard guide uses a different Nerissa Outfit than its anchor. The regenerated Parasol Stray Cat Okayu guide also selects Secret Post-Feast as Premium and Standard Leader, and several old lineups change as the search considers the enlarged roster. These are bounded-search results, not claims of global optimality.

The pinned import and reconciliation orchestrator passed two byte-stable runs with no further dataset changes; its timeline stage recorded the public endpoint as unavailable. The dependency preflight identified four production advisories in Next.js 16.3.8 and Zod 4.4.3. The coordinated Next.js packages were updated to 16.4.3 and Zod to 4.6.7; the production audit then reported no known vulnerabilities. The Zeta guide generated identically before and after that dependency update. Frozen-lockfile installation, production audit, lint, typecheck, all 404 core/web unit tests and three script tests, asset validation, data validation, production build, copy audit, desktop/mobile browser tests (144 passed, 16 intentional skips), and GitHub Pages export and smoke tests (7 passed) passed. One concurrent test run timed out under competing browser load; the full isolated unit rerun passed. Desktop and mobile banner previews and the affected guide route were inspected, including overflow checks. Deployment is verified separately against the pushed commit and GitHub Pages status.
