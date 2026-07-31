# Release gates and rollback

Local builds produce a Next.js standalone Node server. The container runs as the non-root user `node`, exposes port 3000, and checks `/healthz`.

## Tagging

Build immutable images with both the Git SHA and a human release candidate:

```text
yagoo-dori:<git-sha>
yagoo-dori:rc-YYYYMMDD-N
```

Never reuse a production tag. Roll back by redeploying the last smoke-tested SHA, not by rebuilding an old checkout.

## Staging gate

- Rights registry and production dataset gate pass.
- Research-only fixtures are absent from factual public rankings.
- Ranking snapshot and guide are reviewed against the current patch.
- Unit, type, lint, build, browser, visual, and Lighthouse checks pass.
- Image is non-root and `/healthz` reports matching patch/methodology versions.
- Staging hostname is protected by Cloudflare Access.
- User approves the exact stack/environment change.

## Production gate

- Staging desktop/mobile smoke checks pass.
- `yagoo-dori.cc` certificate, Tunnel route, canonical URL, and robots behavior are confirmed.
- Previous image SHA and one-command rollback are recorded.
- User gives explicit approval to route production traffic.

The repository does not contain Cloudflare tokens, Tunnel credentials, or production secrets.
