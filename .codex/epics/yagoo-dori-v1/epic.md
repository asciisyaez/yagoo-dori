---
id: E01
slug: yagoo-dori-v1
created: 2026-07-29
reset: 2026-07-30
status: executing
answers:
  scope: "Build the most useful and accurate English hololive Dreams database, tier list, and team-building site."
  constraints: ["public sources only", "no synthetic public data", "no private game access", "no future GitHub Pages replacement without explicit owner authorization"]
  approach: "Pinned real data, independently checked mechanics, an art-led Prydwen-inspired information architecture, and an original Yagoo-dori interaction language."
  goal: "A complete, usable game reference whose claims are traceable and whose public interface never exposes internal workflow clutter."
assumptions:
  - "Dark-first dense game-database UI is the current visual direction from the supplied reference."
  - "Public hololive Dreams artwork should be downloaded locally with source metadata."
  - "The previous synthetic dataset, scoring outputs, and field-guide UI are rejected and earn no progress."
---

# Yagoo-dori v1 North-Star reset

## Problem

The first implementation optimized for research process rather than player usefulness. It shipped a decorative field-guide interface, prominent disclaimers and workflow warnings, eight fabricated card fixtures, and arbitrary scores. The tracker counted this rejected work as 89.3% complete.

## Approach

Rebuild around player tasks:

1. Browse every real 4★ and 5★ Member card.
2. Scan a complete, source-labeled tier matrix.
3. Inspect actual stats and Active, Passive, Special, and Leader/Outfit effects.
4. Compare legal teams and formation order only after the real mechanics are implemented.

Use HolodoriDB’s pinned public English/Japanese snapshots for structured relationships, verify critical interpretations against official, AppMedia, and Game8 material, and keep source metadata behind the product surface. Use public card art locally with a source manifest.

The interface takes Prydwen’s density and navigation hierarchy as a usability benchmark without copying its branding or code. Yagoo-dori uses an original after-hours live-control-desk identity: graphite/navy chrome, cyan navigation, restrained coral/amber tier accents, colorful game art, and purposeful motion.

## Release state

The historical v0.1 product is already public at the GitHub Pages URL recorded in
`docs/release.md` and passed its release smoke checks. The Pages workflow remains
guarded for future replacements. Exact full-roster certification is not a v0.1
release prerequisite and is tracked separately in the v0.2 certification epic.

## Out of scope

- Accounts, comments, votes, CMS, ads, affiliates, paywalls, public writes, or automatic publication.
- Private APIs, game-client extraction/decryption, installed game files, account automation, or scrape-protection bypass.
- Displaying calculated Yagoo-dori scores before the actual score inputs and mechanics are represented and tested.
- Changing repository visibility, deployment variables, or future Pages releases without explicit owner authorization.

## Ticket graph

```text
N01 ──┬──► N02 ──► N03A ──┬──► N03B ──┐
      │                     └──► N03C ──┴──► N03D ──► N05 ──┐
      └──► N04 ───────────────────────────────┬──► N06A ──┬──► N06B ──┤
                                              │           └──► N06C ──┤
                                              └───────────────────────► N07
```

| ID | Title | Weight | Depends on |
|---|---|---:|---|
| N01 | North-Star charter, IA brief, and honest status reset | 5% | — |
| N02 | Pinned real dataset and public artwork intake | 25% | N01 |
| N03A | Evidence-linked mechanics catalog and schemas | 4% | N02 |
| N03B | Deterministic team and skill evaluator | 7% | N03A |
| N03C | Evidence-linked song and chart contexts | 3% | N03A |
| N03D | Native card rubric and tier snapshot (v0.1) | 6% | N03B, N03C |
| N04 | Prydwen-inspired application shell and design system | 15% | N01 |
| N05 | Complete, usable Member-card tier list | 10% | N02, N03B, N03C, N03D, N04 |
| N06A | Combined card and Outfit database product cleanup | 5% | N02, N04 |
| N06B | Scope-qualified optimizer-backed team guides | 7% | N03B, N03C, N06A |
| N06C | Owned-roster team calculator | 8% | N03B, N03C, N04, N06A |
| N07 | Accuracy review, responsive QA, and verified v0.1 Pages release | 5% | N05, N06B, N06C |

The scalable exact optimizer, compiled parity kernel, and content-addressed
certificates are v0.2 work. A calculator or guide may be exact only for its
declared exhaustive scope; otherwise it must retain the existing bounded
disclosure. See `.codex/epics/yagoo-dori-v0.2-exact/`.

## Accuracy boundary

Current third-party tiers may be displayed only as clearly attributed editorial snapshots. They do not become Yagoo-dori’s mathematical ranking or an input to it. The previous simulator and optimizer are quarantined until replaced; deterministic output is not evidence that an invented model is correct. Native tiers and team guides require a source-linked effect compiler, legal deterministic evaluator, explicit song contexts, and independent search checks.

## Drift log

See `drift-log.md`.
