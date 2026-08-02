---
id: N07
title: Accuracy review responsive QA and verified v0.1 GitHub Pages release
status: done
depends_on: [N05, N06B, N06C]
parallelizable: false
parent_epic: yagoo-dori-v1
---

# N07: Accuracy review, responsive QA, and verified v0.1 GitHub Pages release

## Acceptance criteria

- [x] Accuracy audit covers every public card count and representative mechanic.
- [x] Playwright covers sidebar, search, URL filters, tier matrix, profiles, mobile navigation, and reduced motion.
- [x] Asset and data validation fail on missing source mappings or fabricated records.
- [x] Mobile Lighthouse meets the agreed performance, accessibility, and SEO targets.
- [x] Repository-subpath static export passes desktop/mobile browser smoke with local artwork and the calculator Worker.
- [x] Public-history, dependency, and credential audits are clean or have an explicitly accepted exception.
- [x] Gated GitHub Pages workflow and rollback procedure are verified without changing external settings.
- [x] User approves the reviewed working tree before commit or deployment.

## Verification evidence

The v0.1 release is already public and its deployment history and live smoke
checks are recorded in `docs/qa/local-release.md`. The guarded workflow now
protects future replacements; this ticket does not wait for the v0.2 exact
optimizer.
