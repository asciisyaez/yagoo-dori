# Yagoo-dori repository charter

## North Star

Build the most useful and accurate English hololive Dreams database, tier-list, and team-building site, released from the public `asciisyaez/yagoo-dori` repository through GitHub Pages.

- Optimize every public screen for fast game decisions: find a card, understand its skills, compare it, and build a legal team.
- Use Prydwen as the information-architecture and density benchmark: persistent grouped navigation, compact filters, art-led records, and scan-friendly tier rows. Keep Yagoo-dori’s branding, code, motion, and visual language original.
- Never expose synthetic cards, invented mechanics, arbitrary scores, or fake precision.
- Put this exact sentence once, as a small muted footer line: “Unofficial fan site; not affiliated with COVER Corp. or QualiArts.”
- Keep research workflow, provenance, uncertainty, and internal review state backstage or on an optional source page. Do not turn repository instructions into product features.

## Start and end status

At the beginning and end of every task, run `pnpm project:status` and report:

1. Core objective.
2. Current milestone and active ticket.
3. Overall verified completion percentage.
4. Completed since the previous report.
5. Blockers.
6. Next unblocked action.

Rejected or blocked work earns no progress. A checked criterion counts only when its ticket is `done`.

## Data and research rules

- Pin public structured inputs by commit or retrieval timestamp. HolodoriDB English and Japanese repositories are valid structured inputs.
- Verify entity relationships and important mechanics against official materials and independent references such as AppMedia and Game8. Record disagreements; never silently merge conflicting values.
- Record source URL, upstream version, retrieval date, and the transformation used for every generated dataset.
- Model the game that exists: a Leader/Outfit plus five Member cards, actual Performance/Technique/Sense stats, Cute/Pure/Happy attributes, Active/Passive/Special/Leader skills, triggers, target limits, formation order, progression, and legal team constraints.
- Do not show a Yagoo-dori score or tier until the inputs and mechanics that produce it are implemented and tested. Source-attributed editorial tiers may be shown as editorial references, never as Yagoo-dori calculations.
- Do not access private APIs, extract or decrypt the game client, automate an account, use installed game files, or bypass scrape protection.

## Artwork rules

- Use publicly posted hololive Dreams card art and portraits locally in the site.
- Keep a backstage asset manifest containing the local path, source URL, retrieval date, and associated card or talent.
- Do not hotlink production UI images.
- Never show “Art pending rights,” rights badges, permission requests, or provenance warnings in card and tier-list UI.

## Product rules

- Desktop uses a persistent grouped sidebar; mobile uses a compact accessible drawer.
- Tier pages lead with context tabs, search, compact filters, and a real tier matrix.
- Card art is the primary scanning unit. Text and mechanics support it.
- URL-backed filters, keyboard navigation, reduced motion, responsive images, and mobile readability are mandatory.
- No accounts, comments, votes, CMS, ads, affiliate links, paywalls, or public write API in v1.
- Production is a repository-subpath-safe static export. Keep Pages deployment disabled until the user completes the explicit public-release checklist.

## Verification

Run, in order:

```text
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level=high
pnpm lint
pnpm typecheck
pnpm test
pnpm assets:check
pnpm data:validate
pnpm build
pnpm test:e2e
pnpm build:pages
pnpm test:e2e:pages
pnpm project:status
```

Do not mark a ticket done until its checked criteria have current evidence.
