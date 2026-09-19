# September 18 announcement intake

Historical preparation notes. Superseded by the full September 19 intake in `meta-intake-2026-09-19.md`; the announcement-only artifact and promotional image were replaced with the complete card panel before publication.

## Result and boundary

The September 19 banner is **Seeking the Summer Cool** / 涼を求めるトリップガチャ. It starts at 11:00 JST. The homepage adds an announcement panel with locally stored Shiori promotional artwork and the four solo-event chapters, whose separate start time is 20:00 JST. The still-current Secret Vacation banner remains visible with explicit dates.

The full card intake was attempted but stopped before writing datasets: the AppMedia talent pages have no matching full illustrations for the new cards, and the declared Game8 fallback has no corresponding entries. Current card profile pages contain skill summaries but blank stats, Connect values, and illustration sections. Do not substitute old card art or pass a promotional screenshot as an unaltered card illustration. Keep the verified 127-card rankings and 21 guides until source assets are complete.

## Examined upstream revision

- English: `f7428d4092d57b34311f030e00ff46e7dbbc29e8`, https://github.com/HolodoriDB/holodori-db-eng-diff
- Japanese: `a22c8e29a981a8987bf2074c245e2fc40ad4dbea`, https://github.com/HolodoriDB/holodori-db-jpn-diff
- Master: `927a8489062cfb8aaee197689930a4c4e9c622e9ebbf8b80577bdbe5f065dcf9`
- Retrieval: 2026-09-18. English head timestamp: 2026-09-18T10:50:49Z.
- Banner localization: `LangGachaPoint_Eng.json`, row `la-gacha_point-pickup-260919`; remove only `Gacha Pts` suffix.
- New upstream IDs: `card-00004-5-uniq-0081-00` (Aki), `card-00035-5-uniq-0082-00` (La+), `card-04013-5-uniq-0083-00` (Shiori), `card-03005-5-uniq-0084-00` (Anya). These have not entered the public card catalog or native calculations.
- Import script pins were restored after the failed intake; published datasets, scoring methodology, snapshot `2026-09-08-yd-native-2.1`, and existing guides are unchanged.

## Public evidence

- Banner timing, talent lineup and promotional artwork: https://appmedia.jp/hololive-dreams/80409871
- Official announcement reproduced by Dengeki: https://dengekionline.com/article/202609/88492 . Event chapter dates: Aki September 19, Shiori September 21, La+ September 23, Anya September 25, each at 20:00 JST.
- Current card profiles checked: https://appmedia.jp/hololive-dreams/80409217 , https://appmedia.jp/hololive-dreams/80409475 , https://appmedia.jp/hololive-dreams/80409559 , https://appmedia.jp/hololive-dreams/80409709 . Avoid the older placeholder Anya page 80407963.
- Declared artwork fallback checked: https://game8.jp/hololive-dreams/800904 . No new-banner illustration entries present at retrieval.
- No banner end date was available; none is invented. La+'s new song retains its announced Japanese title rather than an invented English translation.

The announcement artifact at `data/native/upcoming-banner-v1.json` records provenance, exact source image URL, local path, dimensions, associated card/talent IDs and SHA-256. It is deliberately separate from card-art manifests and uncalculated card records.

## Verification

The mandatory production audit found GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4 in Next.js 16.2.12, plus GHSA-rgj7-g3m4-5g8c in sharp 0.35.3. Updated Next.js, its MDX package and ESLint config to 16.3.3, and sharp plus its override to 0.35.4. The refreshed lockfile passes the production audit with no known vulnerabilities.

Passed: frozen install, production audit, lint, typecheck, 379 core plus 22 web tests, asset provenance/hash checks (including the announcement image), data validation, production build, 98 desktop/mobile browser tests (10 intentional skips), Pages build and all 6 Pages tests. The image assertion was adjusted to cover both Next.js's encoded optimization URL and direct static-export paths.

Copy audit passes: 200 occurrences, zero violations/unresolved entries, digest `65aaeba2c2735d9caccd975dcb40584ce7f8fedef2818fbb2609923c6a563f21`.

Desktop/mobile announcement screenshots: ignored `output/playwright/sept18-announcement-desktop.png` and `output/playwright/sept18-announcement-mobile.png`. Visual checks found no broken images or horizontal overflow. Local static preview: http://127.0.0.1:3100/yagoo-dori/#announced-banner-heading . No commit or publication performed for this intake.
