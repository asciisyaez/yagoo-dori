# October 19 verified banner update

The user requested the update-holodori-meta workflow and authorized publication after verification.

## Public inputs checked

Actual retrieval: October 19, 2026 UTC. Both repositories were resolved through Git HEAD and the public GitHub commit API, then shallow-cloned at the exact commits for reproducible isolated imports:

- ENG: https://github.com/HolodoriDB/holodori-db-eng-diff/commit/c98eddf11f81ecc65bfd1ca50427b59224627730
- JPN: https://github.com/HolodoriDB/holodori-db-jpn-diff/commit/6680c7c37a8a3b3d56d919df823dca318db0d802
- Master: `65badf8533aacbc04382f97f0f5f56740e761e6f5be6172d8440ae9061deebe7`.

These remain the latest public revisions. Their 138 four/five-star card records and all 138 compiled card mechanics exactly match the retained site data. There is no verified new numerical card intake.

## Announcement corroboration

QualiArts' official press release, reproduced by GameBiz at https://gamebiz.jp/news/434264, establishes the four new five-star Members, exact Japanese card titles, gacha window, four separate chapters, and four new solo songs. AppMedia independently corroborates the banner and Members at https://appmedia.jp/hololive-dreams/80492365 and Member pages 80492269, 80492290, 80492317, and 80492338.

Gacha: October 19 11:00 through October 29 10:59 JST. Spotlight event: October 19 20:00 through October 27 19:59 JST. Towa, Kaela, Botan, and Bijou chapters begin at 20:00 JST on October 19, 21, 23, and 25 respectively; each ends two days later at 19:59 JST. These windows are distinct from the gacha window.

Songs, in chapter order: Shallow Shadow; Forge My Soul; アマリリス; CORE//UNBREAKABLE. No song IDs are supplied by the announcement, so the site stores them as null rather than manufacturing joins.

The English event heading is a site translation of あふれる光と、渚のドレスコード. All four Japanese card titles are retained verbatim. Talent names were joined to existing explicit talent records, not inferred from card-ID sequences.

## Artwork and public changes

Four unchanged public promotional Member images from AppMedia are stored under `apps/web/public/game/announcements/seaside-days/`. The separate announcement artwork manifest records source page/image, retrieval date, talent, dimensions (1000x563), hash, and transformation. They are promotional announcement images, not database illustrations subject to the database's resolution floor. The asset checker validates their hashes and dimensions.

The homepage shows the banner, Member announcements, and each chapter window. It does not link an announcement to a fabricated card profile. The previous banner's three cards no longer carry current-banner New badges. The existing database remains 138 verified cards and 32 retained guides. Database and tier-page coverage copy no longer claims to contain every current game card while the four new Members remain announcement-only.

## Blocked numerical intake

The four announced cards and four event songs do not exist in the current pinned structured tables. They do not enter native rankings, comparisons, guides, or the scoring engine.

An isolated ordered import reproduced unchanged public cards and mechanics. The latest song input contains 216 songs and 864 aggregate chart keys, versus the retained 203/812. However, every latest `MusicDifficultyChart` row lacks both `chartHash` and `normalNoteCount`. After adjusting only isolated count assertions to inspect the candidate output, all 864 chart hashes remained absent and all normal-note counts normalized to null. This output was not imported into the repository. The documented public timing revision endpoint returned HTTP 404. Missing timing/hash evidence was not guessed, and the old exact rows were not repinned as current evidence.

Both blockers are recorded in `data/review-queue.json`. There is no new numerical snapshot: `2026-10-07-yd-native-2.1` is retained. Native numerical scores, ranks, tiers, guides, chart projections, methodology, and frozen benchmark have zero deltas. Regenerating them with incomplete inputs or a fresh date would falsely imply a verified numerical update.

## Verification and publication

Passed the frozen install, production dependency audit (no known vulnerabilities), lint, typecheck, 379 core and 25 web unit tests, asset validation, data validation, production build, 124 browser checks (14 intentional device-specific skips), Pages build (4,465 files), and all 7 static-hosting smoke tests. The two stale previous-banner New-badge expectations were corrected and rerun successfully on desktop and mobile. Local browser checks used the installed Chromium executable.

Copy audit passed with 271 occurrences, zero violations and unresolved entries, and stable digest `42ea9ade2cb890cc45d68a655a8d85e8ea0efd13064ff64e5854d37aad3d26bd`. The ledger also classifies the earlier roll comparison's explicitly bounded best-found wording without changing its behavior.

The announcement, tier matrix, retained Towa profile, guide index, and retained Aki guide were visually reviewed at desktop (1440px) and mobile (390px) sizes. The four announcement images were individually inspected against the named talents and Japanese titles.

Publish only this verified announcement change set under the user's explicit authorization. GitHub verification and deployment results are reported in the release response; numerical intake remains blocked as described above.
