# Yagoo-dori

Yagoo-dori is an English-first hololive Dreams database, combined Member/Leader Outfit tier list, and team-building project. It includes the complete current 4★ and 5★ roster, locally stored game artwork, searchable card/talent/Outfit records, a deterministic native ranking model, and search-backed team guides.

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
pnpm lint
pnpm typecheck
pnpm test
pnpm assets:check
pnpm data:validate
pnpm build
pnpm test:e2e
pnpm project:status
```

## Current data snapshot

- 54 talents
- 59 five-star Member cards
- 54 four-star Member cards
- 113 linked Leader Outfits
- 226 local card icons and illustrations
- 177 songs and 708 pinned aggregate chart contexts
- Three investment lenses: Low Investment, Standard Manual, and Max Ceiling

The public Member and Leader Outfit bands are Yagoo-dori calculations derived from complete matched substitutions across 300 contexts per entity type, a 21-reference/9-current chart corpus, current skills and stats, and frozen robust baselines. Four hundred deterministic bootstrap resamples estimate uncertainty. The bands remain marked **Theorycraft Beta** and are relative comparisons under a neutral account state rather than absolute Live Score predictions.

## Refreshing generated results

After reviewing an upstream data update, regenerate the deterministic outputs in order:

```powershell
pnpm data:sync
pnpm rankings:generate
pnpm guides:generate
pnpm data:validate
```
