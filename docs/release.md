# GitHub Pages release

The release target is the public GitHub repository `asciisyaez/yagoo-dori`, published at `https://asciisyaez.github.io/yagoo-dori/`. No domain purchase, Node host, container registry, Cloudflare Tunnel, or runtime database is required.

## Current release state

The v0.1 product is already public and has passed the release smoke checks. The
successful Pages deployment history is part of the release record; the current
repository state is not waiting for its first activation.

The Pages workflow remains guarded for **future** pushes and manual redeploys.
It runs only when both repository Actions variables required by
`.github/workflows/pages.yml` authorize a deployment. This guard prevents an
unreviewed commit from replacing the live v0.1 site; it does not describe an
unreleased product. Exact optimizer certification is a separate v0.2 workstream
and is not a prerequisite for the historical v0.1 deployment.

## Release architecture

- The normal build remains available for local standalone QA.
- `pnpm build:pages` produces a static export in `apps/web/out` with the repository base path embedded at build time.
- `.github/workflows/pages.yml` builds and deploys that export using GitHub's Pages artifact flow.
- The entire Pages workflow is disabled unless both owner-controlled deployment gates are enabled.
- The two-variable guard now protects an already-live v0.1 deployment from accidental future replacement. The repository does not document the current state of those gates.
- No repository setting, visibility, Pages source, or deployment variable is changed by local preparation.

## Future-release preflight

Before authorizing a future Pages deployment:

1. Confirm the full verification chain in `AGENTS.md` passes on the final commit.
2. Confirm `pnpm audit --prod` reports no known vulnerabilities.
3. Confirm the public `main` workflow is green.
4. Review the full Git history for credentials and personal metadata.
5. Confirm every reachable commit and the `v0.1.0` tag use the GitHub noreply address and contain none of the purged superseded files.
6. Confirm the two deployment gates are intentionally authorized for the reviewed commit; keep them guarded otherwise.

## Future Pages deployment authorization

The v0.1 activation has already occurred. Use these steps only when the owner
intends to replace the live site with a later reviewed release:

1. In **Settings → Pages**, choose **GitHub Actions** as the publishing source.
2. In **Settings → Secrets and variables → Actions → Variables**, enable `PAGES_DEPLOY_ENABLED` only after the repository is ready.
3. After completing every checklist item above, enable `PUBLIC_RELEASE_CHECKLIST_COMPLETE`.
4. Run **Deploy GitHub Pages** from the Actions tab.
5. Confirm the deployment environment reports `https://asciisyaez.github.io/yagoo-dori/` and run the release smoke checks.

## Post-public hardening

- Enable secret scanning, Dependabot alerts, and private vulnerability reporting.
- Add a `main` ruleset requiring the Verify workflow before merge.
- Add a repository description, relevant topics, and the Pages URL as the homepage.
- Decide whether to add a project-code license. Public visibility alone does not require or imply an open-source license.

## Rollback

Disable `PUBLIC_RELEASE_CHECKLIST_COMPLETE` (and, if needed, `PAGES_DEPLOY_ENABLED`) to stop new deployments. Revert the faulty release commit on `main`, restore the last verified commit, and run the Pages workflow again after re-completing the checklist. Git history and the Pages deployment log provide the release record; no mutable container tag is involved.
