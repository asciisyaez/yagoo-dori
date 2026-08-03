# Testing Guidelines

## Test Framework

- **Unit**: Vitest 4.1.10 (`packages/core/vitest.config.ts`,
  `apps/web/vitest.config.ts`)
- **E2E**: Playwright 1.62.0 (`playwright.config.ts`,
  `playwright.pages.config.ts` at repo root)

## Running Tests

```bash
# All unit tests (recursive, core + web)
pnpm test

# Core only
pnpm test:unit

# Specific core test file(s)
pnpm --filter @yagoo-dori/core test -- exact-optimizer-kernel.test.ts

# Coverage (text + json-summary reporters)
pnpm --filter @yagoo-dori/core test -- --coverage

# E2E against the standalone server (builds first, port 3000)
pnpm test:e2e

# E2E against the static Pages export (port 3100, serial)
pnpm test:e2e:pages
```

## Test Organization

- Core: colocated `packages/core/src/<module>.test.ts` — 46 files, no separate
  `__tests__` directory. `testTimeout: 15_000` because real-data optimizer
  proofs exceed the 5 s default.
- Web: `apps/web/src/**/*.test.{ts,tsx}` (currently lib-only:
  worker-client protocol and roster storage). `passWithNoTests: true`.
- E2E: `apps/web/e2e/` (desktop-chromium + mobile-chromium/Pixel 7 projects;
  real Worker calculator integration run) and `apps/web/pages-e2e/`
  (base-path deep links, no failed same-origin requests, local images only).

## Writing Tests

- Name the file after the module under test and colocate it.
- Use real pinned data over synthetic fixtures where the suite already does;
  synthetic fixtures must be clearly non-shippable (data:validate rejects
  synthetic cards in product data).
- Exactness tests assert integer micro-units and stable digests — never
  `toBeCloseTo` or epsilon comparisons for parity/tie/pruning claims.
- Boundary corpora (accumulator enclosures, canonical buckets, fallback
  reasons) live in dedicated tests, e.g.
  `exact-optimizer-bulk-accumulation.test.ts`.
- Determinism beyond unit tests is enforced by evidence artifacts in
  `data/native/` plus `pnpm data:validate` — there is no snapshot/visual
  testing in this repo.

## Coverage Requirements

Not defined as a numeric threshold. The operative gates are: affected unit
tests pass, new logic has tests (or a logged coverage-debt entry), and the
applicable optimizer evidence checks pass (see docs/TRIP-config.md, Testing
sections).
