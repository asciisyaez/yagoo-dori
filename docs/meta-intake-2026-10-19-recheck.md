# October 19 numerical card intake recheck

This supersedes the announcement-only result in `meta-intake-2026-10-19.md`. The user requested another source check and retained authorization to publish the verified update.

## Pinned inputs and reproducibility

Retrieved October 19, 2026 UTC:

- ENG `29963557c9ea6f2b1270837096a8ce8cf034c888` at https://github.com/HolodoriDB/holodori-db-eng-diff
- JPN `d7d2712b764c26120b2c91058708d6bae738f3ad` at https://github.com/HolodoriDB/holodori-db-jpn-diff
- Shared master `e1eea8627c36e512ed0f8f662d0d80e14b9000cb8facd546d38e492e91a3c528`.

Ordered public/mechanics/song imports and the patch-intake orchestrator completed two byte-stable passes. Existing verified artwork was checked by hash, dimensions, identity, and completeness before reuse; this avoids requiring old editorial source pages to retain their historical image links. Four new icon/illustration pairs were independently downloaded and reviewed. Their provenance is in the asset manifest. Game8 original illustrations are 2101×1165 and stored unchanged with exact dimension exceptions; three icons are 300×300. Bijou uses Game8’s unchanged 185×185 original under an exact dimension exception: AppMedia’s 300px image embeds an incorrect Cute badge, while the structured card and both sources’ text specify Happy. The selected Game8 icon correctly shows Happy and Advent. No image was upscaled. Preview generation and validation now use the installed, lockfile-pinned sharp 0.35.5 instead of the stale 0.35.4 generator guard.

## New cards and corroboration

The four explicit Card IDs are:

- Tokoyami Towa, Shady Hammock Days: `card-00027-5-uniq-0092-00`
- Shishiro Botan, Slurping Frenzy: `card-00032-5-uniq-0093-00`
- Koseki Bijou, Beaming Sandcastle: `card-04014-5-uniq-0094-00`
- Kaela Kovalskia, Shady Shiny Memory: `card-03008-5-uniq-0095-00`

Identities and schedules match the QualiArts release reproduced at https://gamebiz.jp/news/434264. Skills and identities were independently checked against AppMedia 80492269/80492317/80492338/80492290 and Game8 833392/833390/833389/833391. The new English titles and Music IDs m0365/m0366/m0367/m0368 are explicitly joined from the pinned language and music tables. Banner links now open numerical card profiles; all four appear in the database, Member and Outfit tiers, roster picker, and roll comparison.

All 138 existing public card and compiled mechanics records are identical. The catalog now contains 142 cards (88 five-star, 54 four-star), fully mapped with no unresolved skill references. The four additions use existing supported trigger/effect families; none uses singer-conditional skills, so the corpus-refreeze tripwire is not triggered.

There is a recorded source disagreement: both structured repositories specify Kaela P/T/S distribution 268/302/430 and Botan 302/268/430, while both editorial pages swap their P/T stat categories. The import preserves the explicit, identical ENG/JPN fields rather than silently replacing them with editorial values. This discrepancy remains in the review queue for an authoritative public correction. Editorial tiers and recommendations are never calculation inputs.

## Retained song and timing boundary

The latest source now has 220 songs and 880 chart rows, but every chart still lacks chartHash and normalNoteCount. The public timing revision endpoint still returns HTTP 404. The scoring song import retains its explicit historical commit `f7428d4092d57b34311f030e00ff46e7dbbc29e8`, 203 songs/812 chart contexts, and the frozen 30-chart benchmark. No historical hash is presented as current October chart evidence. The orchestrator reconciled every chart in that retained aggregate dataset and recorded the unavailable API; no exact timeline was repinned or fabricated. New event song IDs/titles are announcement metadata only.

## Native result

Snapshot `2026-10-19-yd-native-2.1`, fixed generated-at `2026-10-19T07:00:00.000Z`, same six frozen baselines and methodology. The changelog contains 24 new entries across six ranking lenses, no removed entries, zero existing score changes, 509 rank shifts caused by insertions, and no existing numerical tier changes. Standard Manual: Towa S rank 15, Bijou A rank 45, Kaela A rank 49, Botan B rank 62. These are provisional model tiers.

All 32 existing guides were regenerated before adding four new guides, for 36 total. All eight new guide Leader identities were checked against explicit card/Costume/Leader joins (premium and standard use the new card’s Outfit; accessible uses the talent’s four-star Outfit). The full guide set references 132 distinct verified cards. The final projection contains 120 rating chart timelines and 118,617 exact note events, plus 24 explicitly unavailable rows (previously 112 exact / 21 unavailable). The extra projection rows come from the retained corpus, not newly inferred October timing.

The Board artifact was regenerated to bind the new mechanics file hash; topology, budgets, unlock rules, and node values are unchanged.

The exact-optimizer scope was refreshed for the 142-card roster (395,116,176 legal five-Member sets). Full certification remains blocked because parity/root-bound evidence and cost measurements are stale; no full shards were launched or authorized.

## Guide regeneration

The full existing guide set is regenerated first with no anchor filter, followed by projection for the four new anchors, their guide generation, and one final unfiltered projection. The generator now accepts up to four isolated worker processes and merges their schema-checked results in the original deterministic order. No output replaces the published set until every requested anchor succeeds. Aki's complete serialized output from one parallel worker was byte-for-byte identical to a separately regenerated serial run at the same timestamp.

## Verification

Desktop (1440px) and mobile (390px) banner, tier matrix, new Towa profile, and Leader Outfit panels were visually reviewed, with no horizontal overflow. The guide index and all four new guide routes were also reviewed at both sizes, including their Standard formation panels. All four full illustrations and icons were inspected against the exact named talents. Focused source/banner/mechanics/relative-model tests: 21 passed. Final copy audit: 306 occurrences, zero unresolved entries or violations; the two newly rendered Bijou passive descriptions explicitly retain the Advent condition and two-recipient limit. Passed the frozen install, production audit (no known vulnerabilities), lint, typecheck, all 379 core and 25 web unit tests, asset validation, and full data validation. The production build generated 830 pages. Browser verification passed 129 cases on the full run plus all four corrected expectation cases on focused desktop/mobile reruns (133 passed in total, 15 intentional device-specific skips). The two expectation fixes track the new roster total and assert the current five Leader recipients rather than a historical lineup. The Pages build produced 4,597 files; all seven static-hosting smoke tests passed, including real calculator/roll Workers and prefixed links. Final copy digest: `1527664c4ca1ca13793f662a9446886802742fca8ae5ddd65d4a8aefaf590fa8`.

Project ledger remains v0.1 100% and exact certification 73%, with X04 blocked. Its next unblocked certification action remains remeasuring cost and refreshing scope-addressed proof evidence, not launching full shards. GitHub CI/deployment confirmation follows publication under the user's existing authorization. Direct live HTTP/browser checks remain blocked by the managed network's Pages-host allowlist, so deployment status is confirmed through GitHub and browser behavior against the exact local export.
