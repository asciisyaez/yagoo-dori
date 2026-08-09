---
name: update-holodori-meta
description: Refresh hololive Dreams cards, skills, Leader Outfits, songs, artwork, native rankings, and team guides from pinned public sources. Use for new cards, balance patches, roster refreshes, HolodoriDB updates, or artwork intake. Produce a reviewable deterministic diff and never publish automatically.
---

# Update the hololive Dreams meta

Prepare one reproducible roster/mechanics/song change set, then recalculate Yagoo-dori's own rankings and guides. Independent sites corroborate facts only; their tier labels and teams do not influence native calculations.

## Pin and normalize

1. Run `pnpm project:status` and read `AGENTS.md`.
2. Resolve the exact English and Japanese HolodoriDB commits. Record repository URL, commit, retrieval time, master version, and transformation in the backstage dataset manifest.
3. Inspect explicit table keys. Join cards, characters, translations, parameter curves, Active/Passive/Special skills, Leader skills, costumes, attributes, generations, songs, charts, and conditions without inferring meaning from IDs.
4. Corroborate important mechanics and entity relationships against official material and at least one current independent reference such as Game8 or AppMedia. Put disagreements in the review queue; never silently merge them.
5. Download publicly posted card art locally and update the backstage asset manifest with card ID, source URL, retrieval date, path, dimensions, and hash. Never hotlink production images or surface provenance messaging in card UI.
6. Run the pinned imports in dependency order:

   ```text
   pnpm data:sync:public
   pnpm data:sync:mechanics
   pnpm data:sync:songs
   ```

7. Review the normalized diff before calculation. Unverified numerical changes stop the affected card from entering a new native snapshot.

## Recalculate

1. Run `pnpm --filter @yagoo-dori/core rankings:generate --generated-at=<fixed ISO timestamp>` with the repository's fixed seeds and frozen baseline.
2. Run `pnpm --filter @yagoo-dori/core guides:generate --generated-at=<same fixed ISO timestamp>` so guide teams use the same roster and methodology snapshot.
3. Attribute native score/rank/tier changes to direct card changes, new synergy, chart/meta changes, new evidence, or methodology corrections. Attribution components must sum to the displayed delta.
4. Keep methodology-version changes separate from game-patch changes. Do not convert an editorial opinion into a native input.

## Verify and review

Run the repository verification sequence in `AGENTS.md` in its exact order. Then preview the tier list, affected card/Outfit profiles, guide index, and affected guide routes at desktop and mobile sizes.

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
