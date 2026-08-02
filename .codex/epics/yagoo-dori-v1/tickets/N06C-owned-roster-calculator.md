---
id: N06C
title: Owned-roster team calculator
status: pending
depends_on: [N03B, N03C, N04, N06A]
parallelizable: true
parent_epic: yagoo-dori-v1
---

# N06C: Owned-roster team calculator

## Acceptance criteria

- [x] Players can select exact owned cards and independent Bloom 0–5 progression, with newly selected cards defaulting to Bloom 0.
- [x] The calculation uses owned cards for both Member and Leader Outfit eligibility and always returns one Leader plus five legal, unique-talent Members.
- [x] Results use the pinned 30-chart Expert benchmark (70% frozen reference and 30% current content) and expose modeled relative utility, exact Leader/Passive source attribution, bounded recipient sets, and owned replacement losses without presenting an absolute Live Score.
- [x] The optimizer runs in a lazy, cancellable browser Worker rather than blocking React or the Next server event loop.
- [x] The roster persists locally by versioned card ID, safely drops stale IDs, and keeps only shareable roster filters in the URL.
- [x] Desktop and mobile flows cover live search, rarity grouping, exact-card selection, Bloom persistence, URL restoration, legal representative-corpus results, and the same-card Leader/Passive attribution regression.
- [x] Optional Oshi mode can require an owned talent as a Member, as the Leader Outfit source, or in both roles; constrained variants are evaluated, persisted locally, and reported without marking incidental roles as locked.
- [x] Every result includes a deterministic suggested left-to-right order chosen from all 120 placements using selected Bloom skill levels, Active cadence and activation probability, Special duration and activation support, combo gates, persistent support, and end clipping across the 30 pinned Expert timelines.
- [ ] Full-roster search has a certified global optimum rather than a bounded heuristic result.
- [x] Exact note and Special-marker timelines support a defensible timing-optimal five-slot order under the documented relative timing model.

## Verification evidence

- The schema-validated fixed-model audit makes the unknown score equation and capped-recipient resolver explicit, proves deterministic relative output, and prevents either uncertainty from becoming an absolute or exact-recipient claim.
- The pinned revision-51 corpus reconciles 704 available charts, 405,819 timed note events, and 3,520 Special markers; four tutorial-only `m9999` charts are explicitly recorded as unavailable.
- The calculator projects the frozen 30-chart benchmark to 29,568 timed note events, 150 exact Special markers, and 120 Fever markers without inventing a Fever score multiplier.
- `formation-order-recommender` compares all 120 placements, records per-chart regret and source hashes, and retains the previous 14-layout model only as a mismatch fallback.
