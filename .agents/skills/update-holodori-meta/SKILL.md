---
name: update-holodori-meta
description: Import or refresh real hololive Dreams cards, skills, Leaders/Outfits, artwork, patches, and source-attributed tier references from pinned public sources. Use for new cards, balance patches, roster refreshes, HolodoriDB updates, or artwork intake. Produce a reviewable diff, corroborate important mechanics, and never publish automatically.
---

# Update Holodori meta

Prepare a real-data change set for review.

## Workflow

1. Run `pnpm project:status` and read `AGENTS.md`.
2. Resolve exact upstream commits for both HolodoriDB English and Japanese repositories. Record commit, retrieval time, repository URL, and the import transformation.
3. Inspect the relevant structured tables rather than guessing from identifiers. Join cards, characters, translations, level curves, Active/Passive/Special skills, Leader skills, costumes, attributes, and generations by their explicit keys.
4. Corroborate counts and important mechanic interpretations against official material and at least one current independent reference such as AppMedia or Game8.
5. Download publicly posted card art locally. Add a backstage asset-manifest entry containing source URL, retrieval date, local path, and card ID. Never show provenance or rights warnings in the product UI.
6. Generate a normalized-data diff. Put conflicting values in the internal review queue; do not silently select one.
7. Keep source-attributed editorial tiers separate from Yagoo-dori calculations. Never manufacture a score to fill a missing field.
8. Run dataset, asset, type, unit, build, and browser validation. Present the diff and preview for review; do not commit, deploy, or publish unless separately requested.

## Refuse

- Private APIs, game-client extraction/decryption, installed game files, account automation, or scrape-protection bypass.
- Invented records, inferred field meanings presented as facts, silent conflicts, or fake ranking precision.
- Hotlinked production images.
- Automatic publication.

The legacy `review-meta-update.ts` helper predates the North-Star reset and must not be used until it is replaced under N02/N03.
