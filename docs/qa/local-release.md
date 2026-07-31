# Local release and QA evidence

T07 proves local release mechanics only. Cloudflare staging and production remain blocked until the rights, content, ranking, access, and explicit user-approval gates in the epic are satisfied.

## Browser coverage

Run `pnpm test:e2e`. The suite covers:

- the permanent unofficial-site disclosure and home navigation;
- URL-backed tier filters, reload persistence, and reset behavior;
- exact card, talent, Leader/Outfit, and guide routes and cross-links;
- mobile navigation readability and containment;
- skip-link and keyboard focus visibility;
- reduced-motion preference behavior.

Playwright runs the same tests in desktop Chromium and a Pixel 7 profile. Test traces are retained on the first retry in CI.

## Container build

Build a commit-addressable image and populate the OCI metadata:

```text
docker build --pull ^
  --build-arg BUILD_DATE=2026-07-30T00:00:00Z ^
  --build-arg VCS_REF=<full-commit-sha> ^
  --build-arg VERSION=<release-tag> ^
  --build-arg SOURCE_URL=<canonical-repository-url> ^
  --tag yagoo-dori:<release-tag> ^
  --tag yagoo-dori:<full-commit-sha> .
```

The final stage contains only the Next.js standalone server, static assets, and public files. It runs as the image's unprivileged `node` user and checks `/healthz`.

Verify the local image:

```text
docker inspect yagoo-dori:<release-tag> --format "{{.Config.User}} {{json .Config.Healthcheck}}"
docker run --rm -p 3000:3000 yagoo-dori:<release-tag>
curl http://127.0.0.1:3000/healthz
```

Do not overwrite or delete commit-SHA tags. Rollback means redeploying the previously smoke-tested SHA tag, verifying `/healthz`, and recording both the outgoing and restored digests. A mutable convenience tag may point to a release, but it is never rollback evidence.

## Verified local image — 2026-07-30

The final locally tested source state was built and verified as `yagoo-dori:local-20260730-r8`.

- Content digest: `sha256:d1fc9850e91947b47d5eec64ba347ef3f19405b14393f1744a7d9db6b2b329b6`
- OCI version: `local-20260730-r8`
- OCI revision: `uncommitted-local`
- OCI source: `https://yagoo-dori.cc`
- Configured runtime user: `node`
- Effective runtime identity: `uid=1000(node) gid=1000(node)`
- Health request: `GET http://127.0.0.1:3200/healthz` returned HTTP 200.
- Health payload includes the research patch, methodology version, `research-only` state, and the canonical unofficial-site disclaimer.
- Container browser smoke confirmed the canonical disclaimer and reset `/tier-list?rarity=4&type=dance&mode=auto` to `/tier-list` with all eight research records visible.

The temporary QA container used host port 3200 and was removed after verification.

### Mobile Lighthouse

Lighthouse 13.4.1 audited the styled container root in its mobile form factor:

| Measure | Result | Gate |
| --- | ---: | --- |
| Performance | 97 | Pass, target ≥90 |
| Accessibility | 100 | Pass, target ≥90 |
| SEO | 69 | Intentionally blocked, target ≥90 |
| Largest Contentful Paint | 2.636 s | Fail, target <2.5 s |
| Cumulative Layout Shift | 0 | Pass, target <0.1 |

The SEO score is intentionally below the release target while the research preview is non-indexable. Lighthouse identified both `<meta name="robots" content="noindex, nofollow">` and the blocking `robots.txt` directive. Remove those controls only at the approved production-indexing gate, then rerun the audit; do not treat the current SEO result as production evidence.

The throttled LCP metric remains above the release target even though the same trace recorded an observed local LCP of 0.302 seconds. The home route avoids speculative above-fold route prefetches and uses optional non-preloaded local fonts. An attempted below-fold `content-visibility` optimization was removed because it produced incomplete full-page visual-regression captures; the strict performance threshold remains open rather than trading away reliable visual evidence.

The Lighthouse CLI wrote a complete JSON report and the results above were parsed from it. On this Windows runner, the CLI subsequently returned `EPERM` while deleting its temporary Chrome profile; that cleanup error did not alter the saved report.

## Open release gates

- Record approved desktop/mobile visual baselines.
- Bring mobile LCP below 2.5 seconds.
- Re-enable indexing only at the approved production gate, then record a mobile SEO score of at least 90.
- Smoke-test an Access-protected staging route after T02, T04, T05, and T06 are verified.
- Route `yagoo-dori.cc` only after explicit user approval and rollback proof.
