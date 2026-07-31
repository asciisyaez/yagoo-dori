---
id: E01
slug: yagoo-dori-v1
created: 2026-07-29
reset: 2026-07-30
status: executing
answers:
  scope: "Build the most useful and accurate English hololive Dreams database, tier list, and team-building site."
  constraints: ["public sources only", "no synthetic public data", "no private game access", "no commit until user review"]
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

## Out of scope

- Accounts, comments, votes, CMS, ads, affiliates, paywalls, public writes, or automatic publication.
- Private APIs, game-client extraction/decryption, installed game files, account automation, or scrape-protection bypass.
- Displaying calculated Yagoo-dori scores before the actual score inputs and mechanics are represented and tested.
- Committing, pushing, or deploying before the user reviews the reset.

## Ticket graph

```text
N01 ──┬──► N02 ──► N03 ──┬──► N05 ──┐
      └──► N04 ───────────┤           ├──► N07
                          └──► N06 ───┘
```

| ID | Title | Weight | Depends on |
|---|---|---:|---|
| N01 | North-Star charter, IA brief, and honest status reset | 5% | — |
| N02 | Pinned real dataset and public artwork intake | 25% | N01 |
| N03 | Actual mechanics schema, simulator, and optimizer | 20% | N02 |
| N04 | Prydwen-inspired application shell and design system | 15% | N01 |
| N05 | Complete, usable Member-card tier list | 15% | N02, N03, N04 |
| N06 | Cards, talents, Leaders, team builder, and guides | 15% | N02, N03, N04 |
| N07 | Accuracy review, responsive QA, container, and release | 5% | N05, N06 |

## Accuracy boundary

Current third-party tiers may be displayed only as clearly attributed editorial snapshots. They do not become Yagoo-dori’s mathematical ranking. The previous simulator and optimizer are quarantined until replaced; deterministic output is not evidence that an invented model is correct.

## Drift log

See `drift-log.md`.
