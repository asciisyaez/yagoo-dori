# GitHub Pages release

The release target is a public GitHub repository named `asciisyaez/yagoo-dori`, published at `https://asciisyaez.github.io/yagoo-dori/`. No domain purchase, Node host, container registry, Cloudflare Tunnel, or runtime database is required.

## Release architecture

- The normal build remains available for local standalone QA.
- `pnpm build:pages` produces a static export in `apps/web/out` with the repository base path embedded at build time.
- `.github/workflows/pages.yml` builds and deploys that export using GitHub's Pages artifact flow.
- The entire Pages workflow is disabled unless the repository variable `PAGES_DEPLOY_ENABLED` is exactly `true`.
- No repository setting, visibility, Pages source, or deployment variable is changed by local preparation.

## Preflight

Before changing visibility:

1. Confirm the full verification chain in `AGENTS.md` passes on the final commit.
2. Confirm `pnpm audit --prod` reports no known vulnerabilities.
3. Confirm the private `main` workflow is green.
4. Review the full Git history for credentials and personal metadata.
5. Decide whether to rewrite the six existing commits and `v0.1.0` tag to use the GitHub noreply address and purge deleted superseded outreach/ticket files, or explicitly accept that metadata and deleted history as public.
6. Rename the current `yaago-dori` repository to `yagoo-dori` so the permanent Pages URL is spelled correctly.

## Manual activation

Perform these steps only after the preflight is complete:

1. In **Settings → General**, rename the repository to `yagoo-dori` if it still uses `yaago-dori`.
2. Update the local remote with `git remote set-url origin https://github.com/asciisyaez/yagoo-dori.git`, then confirm private `main` is green.
3. In **Settings → General → Danger Zone**, change repository visibility to **Public**.
4. In **Settings → Pages**, choose **GitHub Actions** as the publishing source.
5. In **Settings → Secrets and variables → Actions → Variables**, add `PAGES_DEPLOY_ENABLED` with value `true`.
6. Run **Deploy GitHub Pages** from the Actions tab, or push the next reviewed commit to `main`.
7. Confirm the deployment environment reports `https://asciisyaez.github.io/yagoo-dori/` and run the release smoke checks.

## Post-public hardening

- Enable secret scanning, Dependabot alerts, and private vulnerability reporting.
- Add a `main` ruleset requiring the Verify workflow before merge.
- Add a repository description, relevant topics, and the Pages URL as the homepage.
- Decide whether to add a project-code license. Public visibility alone does not require or imply an open-source license.

## Rollback

Set `PAGES_DEPLOY_ENABLED=false` to stop new deployments. Revert the faulty release commit on `main`, restore the last verified commit, and run the Pages workflow again. Git history and the Pages deployment log provide the release record; no mutable container tag is involved.
