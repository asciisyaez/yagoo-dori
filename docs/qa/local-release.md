# GitHub Pages release evidence

N07 release QA validates the static site under a non-root repository path before any GitHub setting is changed.

## Static build

```powershell
pnpm build:pages -- --base-path /yagoo-dori --site-url https://asciisyaez.github.io/yagoo-dori
```

The build must export every static, card, talent, skill, synergy, guide, changelog, and legacy Leader route. Local artwork, Next chunks, fonts, and the calculator Worker must all resolve below `/yagoo-dori/`.

## Browser smoke

```powershell
pnpm test:e2e:pages
```

The Pages smoke covers deep navigation, local images, URL-backed filters after reload, the calculator Worker, mobile navigation, reduced motion, and same-origin request failures while mounted at the repository path.

## Current evidence

The 2026-08-01 Pages candidate produced:

- 654 static routes and 6,221 exported files beneath `/yagoo-dori/`.
- 113 deterministic 1024×576 listing previews backed by the 113 full-resolution local illustrations.
- 177 core tests and 7 web tests passing.
- 55 standard Playwright checks passing with 3 intentional project skips.
- 4 repository-prefix Pages smoke checks passing, including the real calculator Worker and a legacy Leader deep link.
- Mobile Lighthouse scores of Performance 96, Accessibility 100, and SEO 100, with LCP 2.3 seconds, CLS 0, and TBT 80 milliseconds.

Lighthouse was run with mobile DevTools throttling against the gzip-enabled static preview, which mirrors the compressed delivery expected from Pages:

```powershell
pnpm dlx lighthouse@13.4.1 http://127.0.0.1:3100/yagoo-dori/ `
  --port=9222 `
  --only-categories=performance,accessibility,seo `
  --form-factor=mobile `
  --throttling-method=devtools
```

GitHub Pages is enabled through the gated workflow described in `docs/release.md`.

## Public deployment

The 2026-08-01 public release passed the complete Verify and GitHub Pages workflows. Live browser smoke confirmed the homepage, tier list, team calculator, card database, and guide index return successfully with repository-prefixed assets and one footer disclaimer. A five-talent calculator run also returned a legal Leader, five Members, and the modeled five-slot activation order without browser, console, or request failures.
