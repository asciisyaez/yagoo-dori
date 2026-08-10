# External review triage — resolution matrix (2026-08-10)

**Baseline:** HEAD `59fa203` (= deployed Pages commit, verified live this session) · v0.1.7 ·
full AGENTS.md chain green at baseline. **Scope:** every finding ID from the external
review-and-fix instruction set, challenged against HEAD before any change. Line references
are to the baseline commit.

Dispositions: every finding was verified against the actual code by three independent
read-only investigation passes (UX/copy, core model, infra) before dispositioning.

## Overview

| ID | Priority | Disposition | Action taken |
|---|---|---|---|
| MODEL-001 | P1 | CONFIRMED, DEFERRED_WITH_MEASURED_REASON | Already the tracked note-weight/timed-fidelity epic; owner priority call |
| MODEL-002 | P1 | PARTIALLY_VALID_AND_FIXED | Public methodology copy corrected to the real 3-rule central policy |
| MODEL-003 | P1 | CONFIRMED_NOT_FIXED (deferred) | Sensitivity harness queued as its own lane |
| NUM-001 | P1 | PARTIALLY_VALID_NOT_FIXED (deferred) | Full comparator inventory produced (below); unification is parity-obligated |
| RANK-001 | P1 | CONFIRMED_NOT_FIXED (deferred) | Ablation harness queued as its own lane |
| RANK-002 | P1 | CONFIRMED_AND_FIXED | "Investment efficiency" → "Progression value", x-axis stated |
| RANK-003 | P1 | PARTIALLY_VALID_AND_FIXED | Frozen-launch-benchmark labeling on tier page; cohort size shown |
| RANK-004 | P1 | OWNER_DECISION_REQUIRED | Option A (visibility) implemented; gate changes need owner |
| SEARCH-001 | P1 | CONFIRMED_NOT_FIXED (deferred) | Claim already honestly conditional; joint validation queued |
| SEARCH-002 | P1 | PARTIALLY_VALID (deferred remainder) | Screening documented; measured 0/0/0 replay is the current evidence |
| SEARCH-003 | P1 | ALREADY_CORRECT (one noted gap) | Invariant coverage table below |
| SEARCH-004 | P1 | PARTIALLY_VALID_AND_FIXED | "Model utility" headline, not-Live-Score line, Board/Connect exclusion |
| BOARD-001 | P1 | PARTIALLY_VALID_AND_FIXED | Machine-code chip replaced with plain language; scenarios deferred |
| BOARD-002 | P1 | PARTIALLY_VALID_AND_FIXED | NEW exhaustive-vs-beam fixture: measured regret 0 at budgets 4/6/8 |
| BOARD-003 | P1 | CONFIRMED_AND_FIXED | Joint-optimum disclosures added both sides of the import |
| TEST-001 | P1 | CONFIRMED_NOT_FIXED (deferred) | Hand-golden suite queued as its own lane |
| UX-001 | P1 | CONFIRMED_AND_FIXED | Tier page now discloses provisional status, index ranges, gate effects |
| UX-002 | P1 | CONFIRMED_AND_FIXED | Board units named, unquantified-in-range counts, talent names |
| UX-003 | P2 | CONFIRMED_AND_FIXED | Homepage song-implication copy corrected |
| UX-004 | P2 | CONFIRMED_NOT_FIXED (deferred) | Export/import + clear-undo queued as a feature lane |
| A11Y-001 | P1 | PARTIALLY_VALID_NOT_FIXED (deferred) | No axe tooling; strong hand-rolled coverage inventoried; axe lane queued |
| UX-005 | P2 | CONFIRMED_NOT_FIXED (deferred) | Methodology readability lane queued |
| SEO-001 | P2 | CONFIRMED_AND_FIXED | sitemap.ts, robots Sitemap directive, canonical + OG/Twitter metadata |
| CI-001 | P2 | PARTIALLY_VALID_AND_FIXED | Pages gate strengthened (assets:check, data:validate); split deferred |
| REL-001 | P2 | CONFIRMED_AND_FIXED | Deployed==HEAD verified; footer version; smoke:live routes extended |
| DATA-001 | P2 | PARTIALLY_VALID_NOT_FIXED (deferred) | Sync-diff manifest queued |
| DOC-001 | P2 | CONFIRMED_AND_FIXED | Historical banners; ARCHI counts corrected to the 115-card scope |
| OSS-001 | P2 | OWNER_DECISION_REQUIRED | Decision note below |
| PERF-001 | P2 | CONFIRMED_NOT_FIXED (deferred) | Budget harness queued |

## Substantive findings

### MODEL-001 — aggregate utility vs exact timelines
**Evidence:** `native-utility.ts:429-438` builds uniformly spaced synthetic notes
(`uniformNotes`); `:1695-1733` uses time-averaged Special duration coverage with an explicit
no-fabricated-markers comment. Exact timelines are consumed only by
`formation-order-recommender.ts:922-974` (hash-validated, drift-throwing), and only AFTER the
team is selected (`team-calculator.ts:1709-1722`); the result labels this
`formationOrderClaim: "conditional-on-selected-team"` (`:2040`).
**Root cause:** the exact corpus arrived after the aggregate model was frozen.
**Deferral reason (measured):** this is fidelity-backlog epic 1 (note-weight fidelity) +
epic 2 (timed-fidelity), disclosed on the public methodology page since v0.1.5. Switching or
shadow-comparing is a native-utility semantic change carrying the full parity re-execution
obligation, rankings + guides regeneration, and a methodology version bump — a dedicated
lane, not a triage-batch fix. The review's shadow-comparison harness is exactly that epic's
entry gate and stays the recommended first step.
**Residual risk:** team selection and ranking order can differ from an exact-timed
evaluation; magnitude unmeasured until the shadow harness runs.

### MODEL-002 — central-lane policy contract
**Evidence of the defect:** public copy claimed central "shares the lower lane's cautious
answer to the targeting question and differs from it only on overlap"
(`methodology/page.tsx:382-383`) — but `scoreUpInterval` (`native-utility.ts:663-677`, call
sites `:773`, `:893`, `:1621`) takes the **mean** across unresolved application alternatives
for central, while `compilePersistentSupport` (`:645-660`) and
`contributionParameterInterval` (`:567-584`) use the guaranteed floor, and Active collision
uses independent expected maximum (`:718-737`, `:1043`, `:1125`, `:1664-1666`).
**Fix (this batch):** methodology copy now names central as a composition of three
deterministic rules (guaranteed-recipient floor for unresolved stat-effect targeting; plain
average of enumerated readings for ambiguous Active applications; independent expected
maximum for overlap), in both the lane card and the interpretation paragraph. No numeric
change — the code policies are deliberate and untouched.
**Lane ordering:** `lower <= central <= upper` is schema-enforced on every ranking entry
(`native-ranking-schema.ts:33`) and every calculator result
(`team-calculator-contract.ts:77-88`, applied at `team-calculator.ts:2044`).
**Residual risk:** `native-utility.ts:364-371` clamps central into `[lower, upper]` at the
source, so a future lane-policy inversion would be silently repaired rather than surfaced;
machine-readable `centralPolicy` result metadata (and a copy-drift test) would require a
result-schema version bump — deferred with the schema-metadata backlog item.

### NUM-001 — comparator inventory (produced; unification deferred)
| Site | Policy |
|---|---|
| `native-utility.ts:360-362` | six-decimal rounding at interval boundary |
| `team-calculator.ts:415-434` | six-decimal rounding for averaging/subtraction |
| `team-calculator.ts:558-585` (adoption/ordering), `:1590-1595` (ascent stop), `:1695` (seed floor) | raw float compare, no epsilon |
| `team-calculator.ts:113` (`IMPROVEMENT_EPSILON = 1e-6`, used `:752-763`) | display-side replacement impact |
| `team-calculator-contract.ts:640,722` | 1e-5 reconciliation tolerance |
| `formation-order-recommender.ts:29,1053,1073-1077` | relative 1e-9 tie/regret |
| `formation-order-recommender.ts:688` vs `native-utility.ts:728` | expected-max grouping: 1e-9 vs exact `===` (same conceptual operation, two policies) |
| `exact-optimizer-arithmetic.ts:10-86` | integer micro-units, exact/outward |
| `holomem-board-suggester.ts:13,1062-1068` | integer micro-units, exact integer ratios |
**Deferral reason:** any comparator change in the utility/search path is a semantic change
under the parity obligation and can churn published results; determinism is currently pinned
by deep-equal tests. Unification wants its own lane with before/after churn measurement.

### SEARCH-002 — screening basis and measured mitigation
**Evidence:** coarse screen = 2 charts, proxy = 5 charts, both duration/density
extremes + medoid (`team-calculator.ts:328-413`); full corpus = 30 charts (`:1146-1181`).
**Why partially valid rather than confirmed-unmitigated:** search quality is measured
end-to-end, not assumed — the 128-fixture replay (drop-one, Oshi-inversion, budget classes)
reports 0/0/0 at v0.1.6+, and the one screening failure class actually observed
(leader-skill value invisible to raw stat proxies) was root-caused and closed with
leader-anchored ascent starts (Ticket C). The protected standard lane replays inside every
thorough run.
**Deferred remainder:** adversarial mechanics-aware fixtures (singer dominance, late combo
thresholds, end clipping) as a designed sweep.

### SEARCH-003 — invariant coverage at baseline
(a) drop-one monotonicity — `team-calculator-consistency.test.ts:283-293` ✓;
(b) seed lower bound — `:325-345` + `team-calculator.test.ts:791` + contract `:926-934` ✓;
(c) Oshi ≤ unconstrained — consistency `:295-305` + calculator test `:1151` ✓;
(d) input order — reversal covered (`team-calculator.test.ts:136-148`, `:345-357`); general
permutation sweep on a bounded roster NOT covered (noted gap, queued);
(e) deep-equal determinism — consistency `:347-354` ✓;
(f) formation legality — structural via contract on every result + explicit tests ✓;
(g) evaluation ceilings — consistency `:356-371` ✓. No assertion was loosened.

### BOARD-002 — beam quality now measured
beam ≥ greedy was already triple-enforced (runtime throw `holomem-board-suggester.ts:1143`,
contract `holomem-board-contract.ts:432-437`, tests). **New this batch:** an
exhaustive-vs-beam fixture enumerating every connected affordable added-node set at budgets
4/6/8 from the board root — the beam equals the exhaustive optimum at all three
(**measured regret 0**); `beamWidth: 64` literal in the planner deduped to the exported
constant. Residual: no measured rationale for width 64 at large budgets (the provable-optimum
short-circuit at `:1032-1043` covers part of that space).

## Owner decisions required

1. **RANK-004 tier gates** — Option A (keep gates, make effects visible) is implemented:
   the tier page now explains the empty SS/D bands, marks S as the effective top, and
   discloses provisional status. Options B (rebase gates to lens-calibrated boundaries) and
   C (hide unreachable letters) both change published policy and need your call; B requires
   a methodology version + churn analysis.
2. **OSS-001 license/contribution policy** — nothing exists today (no LICENSE, no
   license field, no CONTRIBUTING/SECURITY, templates or scanning config). README says
   "noncommercial fan project" only. Options: (a) explicit "all rights reserved — source
   visible, no license granted" note (safest for third-party art/data); (b) code-only
   license (e.g. MIT scoped to `packages/`/`apps/` code) with an explicit carve-out that
   card art, upstream data, and generated artifacts are NOT covered; (c) full open-source +
   contribution pipeline. Third-party art and upstream game data must not be relicensed in
   any option. Recommended default: (a) now, revisit (b) if contributions are wanted.
3. **Deferred-lane priority** — the substantial programs queued by this triage, roughly by
   decision impact: MODEL-001 shadow comparison (epic gate), RANK-001 ablation harness,
   SEARCH-001 joint team+order validation, TEST-001 hand-calculated goldens, A11Y-001 axe
   smoke + focus tests, UX-004 roster export/import, CI-001 job split, MODEL-003 sensitivity
   harness, UX-005 methodology readability, DATA-001 sync-diff manifest, PERF-001 budgets.

## Release-state record (REL-001)

Source HEAD `59fa203` = exported build = deployed Pages commit (live-verified this session).
All routes in HEAD are live, including `/holomem-board` and talent board sections.
`smoke:live` now probes `/talents/`, `/methodology/`, `/holomem-board/`, and
`/sitemap.xml` in addition to the original five routes. The site footer now displays the
package version. Deployment gates were not touched.
