# GitHub Pages release

The release target is the public GitHub repository `asciisyaez/yagoo-dori`, published at `https://asciisyaez.github.io/yagoo-dori/`. No domain purchase, Node host, container registry, Cloudflare Tunnel, or runtime database is required.

## Release architecture

- The normal build remains available for local standalone QA.
- `pnpm build:pages` produces a static export in `apps/web/out` with the repository base path embedded at build time.
- `.github/workflows/pages.yml` builds and deploys that export using GitHub's Pages artifact flow.
- The entire Pages workflow is disabled unless the repository variable `PAGES_DEPLOY_ENABLED` is exactly `true`.
- No repository setting, visibility, Pages source, or deployment variable is changed by local preparation.

## Preflight

Before enabling GitHub Pages:

1. Confirm the full verification chain in `AGENTS.md` passes on the final commit.
2. Confirm `pnpm audit --prod` reports no known vulnerabilities.
3. Confirm the public `main` workflow is green.
4. Review the full Git history for credentials and personal metadata.
5. Confirm every reachable commit and the `v0.1.0` tag use the GitHub noreply address and contain none of the purged superseded files.
6. Confirm the Pages deployment variable is absent or disabled until the verified public commit is ready.

## GitHub Pages activation

Perform these steps only after the public repository preflight is verified:

1. In **Settings → Pages**, choose **GitHub Actions** as the publishing source.
2. In **Settings → Secrets and variables → Actions → Variables**, add `PAGES_DEPLOY_ENABLED` with value `true`.
3. Run **Deploy GitHub Pages** from the Actions tab.
4. Confirm the deployment environment reports `https://asciisyaez.github.io/yagoo-dori/` and run the release smoke checks.

## Post-public hardening

- Enable secret scanning, Dependabot alerts, and private vulnerability reporting.
- Add a `main` ruleset requiring the Verify workflow before merge.
- Add a repository description, relevant topics, and the Pages URL as the homepage.
- Decide whether to add a project-code license. Public visibility alone does not require or imply an open-source license.

## Rollback

Set `PAGES_DEPLOY_ENABLED=false` to stop new deployments. Revert the faulty release commit on `main`, restore the last verified commit, and run the Pages workflow again. Git history and the Pages deployment log provide the release record; no mutable container tag is involved.
