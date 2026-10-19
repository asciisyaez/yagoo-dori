---
name: update-holodori-meta
description: Refresh hololive Dreams cards, skills, Leader Outfits, songs, artwork, native rankings, and team guides from pinned public sources. Use for new cards, balance patches, roster refreshes, HolodoriDB updates, or artwork intake. Produce a reviewable deterministic diff and never publish automatically.
---

# Update the hololive Dreams meta

Prepare one reproducible roster/mechanics/song change set, then recalculate Yagoo-dori's own rankings and guides. Independent sites corroborate facts only; their tier labels and teams do not influence native calculations.

## Pin and normalize

1. Run `pnpm project:status` and read `AGENTS.md`.
2. Resolve the exact English and Japanese HolodoriDB commits. Record repository URL, commit, retrieval time, master version, and transformation in the backstage dataset manifest.
   When raw GitHub is rate-limited, use the sync helper's Contents-API fallback or set
   `HOLODORI_DB_MIRROR_ROOT` to a local checkout of those exact pinned commits. A
   mirror is only a reproducibility aid for already-public repository data; it is
   not permission to bypass a protected endpoint or scrape a private source.
   The helper reads Git objects at the requested immutable commit, independently
   of checkout HEAD and dirty files. Fetch every requested commit into each mirror,
   including a retained historical song pin; a missing object fails with recovery
   instructions rather than mislabeling current files as historical data.
3. Inspect explicit table keys. Join cards, characters, translations, parameter curves, Active/Passive/Special skills, Leader skills, costumes, attributes, generations, songs, charts, and conditions without inferring meaning from IDs.
4. Corroborate important mechanics and entity relationships against official material and at least one current independent reference such as Game8 or AppMedia. Put disagreements in the review queue; never silently merge them.
5. Download publicly posted card art locally and update the backstage asset manifest with card ID, source URL, retrieval date, path, dimensions, and hash. Never hotlink production images or surface provenance messaging in card UI.
   Compare new icons side by side with existing cards and their full illustrations:
   verify portrait, costume, attribute badge, rarity, frame, and crop. If no correct
   public square icon exists, use an explicit reviewed crop in
   `scripts/lib/card-icon-recipes.mjs`; retain the original, source hash, recipe,
   and pinned renderer. Never replace a conflicting badge with invented artwork.
   `pnpm data:sync:public --reuse-verified-art` verifies unchanged local assets and
   downloads only new or identity-changed cards, avoiding stale editorial mappings
   for old cards. It also applies reviewed icons and regenerates previews.
   `--skip-art` requires complete existing coverage and cannot intake a new card.
6. Run the pinned imports in dependency order:

   ```text
   pnpm data:sync:public --reuse-verified-art
   pnpm data:sync:mechanics
   pnpm data:sync:songs
   ```

7. Review the normalized diff before calculation. Unverified numerical changes stop the affected card from entering a new native snapshot.

### Chart and timeline intake

Run the patch-intake orchestrator after the three imports when a roster patch also
changes songs or charts:

```text
pnpm data:patch-intake --reuse-verified-art --retrieved-at=<YYYY-MM-DD>
```

It must reconcile the aggregate chart key set even when the timing endpoint is
unavailable. New or rehashed charts are recorded as explicit `unavailable` rows,
and stale exact rows are retired only when the API supplied no replacement. Never
reuse an old hash to imply current timing, placement, or order evidence. Re-run
`timelines:project:guides` after this reconciliation so guide projections contain
only exact or explicitly unavailable rows.

If an existing benchmark chart's upstream hash changes and the current timing
asset is unavailable, do not re-pin the stale exact row. Replace that benchmark
entry with a stable, exact, pre-cutoff chart, regenerate the compact benchmark
corpus and its hash, and record the substitution in the review notes.

## Recalculate

1. Run `pnpm --filter @yagoo-dori/core rankings:generate --generated-at=<fixed ISO timestamp>` with the repository's fixed seeds and frozen baseline.
2. Regenerate all existing guides first with no anchor filter, using the same fixed timestamp. Then project guide timelines with the new anchor IDs, generate the new anchor guides, and project once more without filters. This ordering prevents a partial anchor run from dropping existing guides or from referencing a missing timeline row.
3. Attribute native score/rank/tier changes to direct card changes, new synergy, chart/meta changes, new evidence, or methodology corrections. Attribution components must sum to the displayed delta.
4. Keep methodology-version changes separate from game-patch changes. Do not convert an editorial opinion into a native input.

## Verify and review

Run `pnpm copy:audit` as well as the repository verification sequence in `AGENTS.md` in its exact order. Then preview the tier list, affected card/Outfit profiles, guide index, and affected guide routes at desktop and mobile sizes. A generated guide can add new mechanic wording (especially `Score Support Effect`); classify each new occurrence in `scripts/copy-audit-ledger.json` before declaring the intake clean.

Also preview roll comparison with an existing saved roster. Its full-catalog
browser regression must prove that the picker and pending list contain every
unowned 4★/5★ card ID, including alternate cards for owned talents. Search each
new talent and verify every card title. Test a new card through the real Worker,
and distinguish pending comparisons from completed no-upgrade results. Report
the catalog scope explicitly; 3★ cards are not currently supported.

After a mechanics import, run `pnpm board:model` and review the Board model diff
before changing its reviewed mechanics hash. Refresh scope bindings and relative
model audit pins without treating stale exact-certification evidence as current.
Do not regenerate rankings/guides for artwork-only corrections. For publication,
confirm both Verify and Pages workflows against the exact pushed SHA and the
successful deployment status; report any live-origin network restriction separately.

Present:

- pinned upstream commits and generated snapshot IDs;
- normalized card, mechanic, song, and asset changes;
- unresolved disagreements;
- native ranking and guide deltas;
- verification evidence.

Tripwire — singer-conditional skills vs the frozen corpus: the frozen 30-chart
ranking benchmark covers only 24 of 54 talents as singers, and the game ships a
per-talent `music-character` trigger family that no current card uses. If a
patch introduces a card whose skill uses a `music-character` (or other
singer-conditional) trigger for a talent that sings nothing in the frozen
corpus, that skill would be measured permanently inactive. Flag it to the user
as a corpus-refreeze question instead of silently intaking the card.

Do not commit, deploy, or publish unless the user separately requests it.

## Stop instead of guessing

- No private APIs, client extraction/decryption, installed game files, account automation, or scrape-protection bypass.
- No invented records, inferred field meanings presented as facts, silent conflicts, fake precision, or hotlinked production art.
- Never auto-publish a generated ranking or guide.
