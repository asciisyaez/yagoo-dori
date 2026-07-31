# Yagoo-dori

Yagoo-dori is an English-first hololive Dreams database, Member-card tier list, and team-building project. The v0.1 preview includes the complete current 4★ and 5★ roster, real locally stored card artwork, searchable card/talent/Leader Outfit records, and a clearly attributed third-party tier reference while the native mechanics model is developed.

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
- HolodoriDB English commit `060e4c3342a6005ddee94860dd090d24c417c092`
- HolodoriDB Japanese commit `86dfcc47e5cffa4baee72a53c98f7968af699620`

The public SS/S/A view in v0.1 is an attributed AppMedia editorial snapshot. It is not a Yagoo-dori calculation. Native rankings and optimized team guides remain gated on the real mechanics simulator and calibration work tracked in N03.
