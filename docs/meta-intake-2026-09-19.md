# September 19 full banner intake

User authorized the update and publication on September 19. Supersedes the uncommitted announcement-only candidate from September 18.

## Pinned sources

- ENG: https://github.com/HolodoriDB/holodori-db-eng-diff/commit/f7428d4092d57b34311f030e00ff46e7dbbc29e8
- JPN: https://github.com/HolodoriDB/holodori-db-jpn-diff/commit/a22c8e29a981a8987bf2074c245e2fc40ad4dbea
- Master: `927a8489062cfb8aaee197689930a4c4e9c622e9ebbf8b80577bdbe5f065dcf9`
- Retrieval: 2026-09-19. Fixed native generation timestamp: `2026-09-19T12:00:00.000Z`.
- Snapshot: `2026-09-19-yd-native-2.1`; existing methodology and frozen baselines retained.

## Reviewed data

Four new five-star cards: Aki Rosenthal / Mystic Sun Swing (`0081`), La+ Darknesss / Leader’s Secret Pool (`0082`), Shiori Novella / Archived Night Pool (`0083`), Anya Melfissa / Chill Sunny Holiday (`0084`). Total: 131 cards, 77 five-star and 54 four-star. Every card has complete normalized mechanics.

Existing card records and mechanics are unchanged. Catalog changes are one Active effect and two Passive effects, using supported type/generation conditions. No new singer-conditional trigger is used. Existing song/chart fields and scoring rules are unchanged. Four songs added: m0349 Grave of Halo, m0350 Lethal Dose Paranoid, m0351 Glitch Through, m0352 64. Total: 203 songs, 812 aggregate charts, 189 rating-eligible songs.

The public chart API returns 403. The 16 new charts remain explicitly timing-unavailable, for 699 exact and 113 unavailable charts. All 30 exact frozen benchmark charts remain unchanged. No old hash is reused as new timing evidence. Public imports pass the patch-intake idempotence check.

## Corroboration and artwork

Game8 card pages now provide complete stats and skills, matching the normalized cards:

- Aki: https://game8.jp/hololive-dreams/816914
- Shiori: https://game8.jp/hololive-dreams/816913
- La+: https://game8.jp/hololive-dreams/816912
- Anya: https://game8.jp/hololive-dreams/816911

Banner dates: https://game8.jp/hololive-dreams/816917 — September 19 11:00 through September 29 05:59 JST. The official announcement reproduced at https://dengekionline.com/article/202609/88492 establishes four separate chapter launches at 20:00 JST on September 19, 21, 23 and 25. These are kept separate from the gacha dates.

AppMedia provides 300x300 icons on the pinned talent pages but still lacks matching full card art there. Its outfit images are not substitutes for Member illustrations. Game8's declared public card-page originals are 2101x1165; these exact dimensions are documented as per-card floor exceptions, with a future upgrade condition. Images are stored unchanged and visually checked. The generated manifests record source page, source image, retrieval date, dimensions and hashes. Native tiers do not use editorial ratings.

The sharp security patch prepared on September 18 requires the preview generator and verifier pins to move together to 0.35.4. All 131 previews were regenerated under that declared version. Next.js 16.3.3 and its matching MDX/ESLint packages are retained from the audited preparation.

## Scope and publication

The new cards alone receive New badges in Member and Outfit views. The homepage uses the four local card illustrations plus the event chapter schedule. The draft promotional image was replaced by these card assets; it remains recoverable from its recorded public source URL in the September 18 notes.

Exact optimizer scope: `5a8d8445fba9fe634570eb39af6f4343d503234300172d9e7a3972aee66653f4`; 263,641,569 legal Member teams. X04 remains blocked with stale full-scope certification evidence. No certificate claim is introduced.

All 21 retained guides were regenerated before adding the four new anchors, for 25 guides and 75 legal formations. Ten retained guides changed a Member lineup. Guide timeline projections contain 91 exact and 21 explicitly unavailable charts. Existing card scores remain unchanged; the ranking changelog includes 24 new card/lens entries and 514 rank shifts.

Release checks passed: frozen install; production dependency audit (no known vulnerabilities); lint; typecheck; 379 core plus 22 web tests; asset checks; data validation; production build; 106 browser tests (10 intentional device-specific skips); Pages export (4,230 files); all 6 Pages tests. Two old test assumptions were repaired: literal La+ guide titles and exact-card selection when Aki/Anya each have multiple five-star editions.

Copy audit: 233 occurrences, zero violations/unresolved entries; digest `25000d8fc1a73911e1e61b0ac48d44c1aa45bd2788183f847c7eb84572669571`. Desktop/mobile artwork, profiles, tiers, banner and new guides were visually reviewed; screenshots are in ignored `output/playwright/sept19-*.png`.

Ready for the user-authorized publication. Deployment result is reported after the GitHub Pages workflow and live checks finish.
