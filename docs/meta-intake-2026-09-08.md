# September 8 banner intake

Local review candidate for Secret Vacation Getaway (秘密のバケーションガチャ).

## Pinned inputs

- English: https://github.com/HolodoriDB/holodori-db-eng-diff/commit/16d5b81b35cb90cf254a50bdde2a0bcbc328e521
- Japanese: https://github.com/HolodoriDB/holodori-db-jpn-diff/commit/fbbb04b06ede3276a6272d35d87fd7d1ce4b6ed7
- Master version: `e50116c3c75a4da07b27936baa10bdc1eabd71955406848104f2a0e0241ac508`
- Retrieval date: 2026-09-08. Ranking/guide timestamp: `2026-09-08T08:00:00.000Z`.
- English display name: `LangGachaPoint_Eng.json`, row `la-gacha_point-pickup-260908`, with only the `Gacha Pt` suffix removed.

## Reviewed changes

- Three new five-star cards: Takane Lui / Relaxing Executive; Fuwawa Abyssgard / Fluffy Flowing Summer; Mococo Abyssgard / Fuzzy Breezy Summer. All 124 existing normalized card records are unchanged.
- Two additional passive-effect records cover Lui's holoX recipient support at levels 1 and 2. Existing normalized mechanics catalogs, other than these additions, are unchanged after excluding provenance. No new trigger family or singer-dependent skill is introduced.
- Five new songs: m0344 HoloHawk, m0348 Tri-Unity♡LoveSystem, m0363 Simulacre, m0459 Illusion Night, m0527 Mekurumeku Rendezvous. Existing song/chart gameplay fields and score rules are unchanged after excluding provenance.
- The event's three songs are m0348, m0344 and m0527. The other additions are not labeled event songs.
- All 127 local icon/illustration/preview sets pass asset checks; source URLs, dimensions and hashes are in the generated manifests.
- Banner runs September 8 11:00 through September 19 10:59 JST. The separate score challenge starts at noon September 8 and ends September 17 19:59 JST; these schedules must not be conflated.

## Corroboration and access limitations

- Banner: https://appmedia.jp/hololive-dreams/80374798
- Lui: https://appmedia.jp/hololive-dreams/80374726
- Fuwawa: https://appmedia.jp/hololive-dreams/80374735
- Mococo: https://appmedia.jp/hololive-dreams/80374744
- Event: https://appmedia.jp/hololive-dreams/80374936
- Official announcement references: https://x.com/hololive_dreams/status/2096923937074741321 and https://x.com/hololive_dreams/status/2096936520770789420 . Direct retrieval returned 403; accessible corroboration identifies these posts, but direct official verification is not claimed.
- AppMedia max-potential stats and level-2 Active/Passive/Special/Leader descriptions match the pinned normalized cards. Editorial tiers are not calculation inputs.
- Chart API returned 403. The existing 699 exact timelines remain valid; 20 new aggregate chart rows are explicitly unavailable, bringing unavailable coverage to 97. No stale timing hash is reused. All 30 frozen benchmark charts remain exact and unchanged.

## Calculations

- Native snapshot: `2026-09-08-yd-native-2.1`; 127 entries in each of three Member and three Outfit lenses, retaining the frozen baselines and methodology.
- Standard Manual Member tiers: S 21, A 28, B 24, C 54. Fuwawa is S; Lui and Mococo are A under this benchmark.
- All existing card scores remain unchanged; the changelog records 18 new card/lens entries and 494 rank shifts caused by the additions.
- All 18 retained guides were recalculated, then three new anchor guides added (21 total). Sixteen retained guides change at least one Member lineup. Miko's Standard Leader changes to Radiant Beach Shot; Calliope's premium Leader changes to Reaper's Death Flow; Ina's premium Leader changes to Tracing Tide Memories.
- Guide projections now contain 82 exact and 17 explicitly unavailable charts. There are 12 meaningful adjacent exact-chart placement transitions under the regenerated formations.
- Exact optimizer scope: `a8c138a9fd681dd4cda5fa43710d3a5486ec7c40aecb547919a848aba8804818`, with 225,793,048 legal Member teams. Existing full-scope certification evidence remains stale and X04 remains blocked.

## Verification

Completed 2026-09-08: frozen install, production dependency audit (no known vulnerabilities), lint, typecheck, 379 core and 22 web tests, asset checks, data validation, production build, 98 browser tests (10 intentional device-specific skips), Pages build (7,032 files), and all 6 Pages tests. Stale snapshot fixtures found during verification were corrected and the affected gates rerun successfully.

Copy audit passes with 200 occurrences, zero violations and zero unresolved entries; digest `1a7334b250a68720a01d0e1f7486d51356ea3bcd055030ac2c7136e002fb1f63`.

Desktop/mobile visual review completed for the homepage, tier list, three new card/Outfit profiles, guide index, and all three new guide pages. Screenshots are in ignored `output/playwright/sept-*.png`. The static preview is available at http://127.0.0.1:3100/yagoo-dori/ . No commit, push, or publication performed for this intake.
