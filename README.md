# Yagoo-dori

Yagoo-dori is an English-first hololive Dreams database, combined Member/Leader Outfit tier list, and owned-roster team builder. It is a noncommercial fan project built for quick card comparison and legal five-Member team decisions.

## What is included

- 54 talents, 59 five-star Member cards, and 54 four-star Member cards.
- 113 linked Leader Outfits with locally served card icons and illustrations.
- Searchable card, talent, Outfit, skill, synergy, guide, and changelog routes.
- Three ranking lenses backed by pinned mechanics, a frozen 30-chart benchmark, matched substitutions, and deterministic uncertainty estimates.
- A Bloom-aware team calculator with Oshi constraints and all-120-order placement analysis.

Yagoo-dori tiers are comparative results under the published neutral account assumptions. The calculator uses deterministic bounded search and does not claim an absolute Live Score or a certified full-roster global optimum.

## Development

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:3000`.

## Verification

Run the repository checks in this order:

```powershell
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

`pnpm build:pages` produces the repository-subpath-safe static export in `apps/web/out`. See [`docs/release.md`](docs/release.md) for the clean-repository GitHub Pages release checklist.

## Refreshing generated results

After reviewing an upstream update, regenerate deterministic outputs in order:

```powershell
pnpm data:sync
pnpm rankings:generate
pnpm guides:generate
pnpm data:validate
```
