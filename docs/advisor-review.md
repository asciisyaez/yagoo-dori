# Yagoo-dori v1 — Advisor Review Brief

> **HISTORICAL DOCUMENT** — snapshot of 2026-08-02 at the v0.1.0 candidate
> (113-card roster, pre-release working tree). Counts, test tallies, and
> release-state statements below describe that moment and are NOT current
> facts; see docs/2-changelog/ and project:status for the present state.

**Prepared:** 2026-08-02  
**Repository:** [`asciisyaez/yagoo-dori`](https://github.com/asciisyaez/yagoo-dori)  
**Live release:** [`asciisyaez.github.io/yagoo-dori`](https://asciisyaez.github.io/yagoo-dori/)  
**Reviewed baseline:** `77cffa155db5f7ee53f665540b30a157bf86a810` (`docs: mark compiled solver as prototype`)  
**Working state:** the implementation changes described below are in the review working tree and are not yet committed; `v0.1.0` remains the public release checkpoint.

## 1. Executive summary

Yagoo-dori is a player-first, English-language hololive Dreams reference site with three connected jobs:

1. Let a player find and compare every current 4★/5★ Member card and its Leader Outfit.
2. Present a reproducible, mechanics-derived tier list rather than copying an editorial tier label.
3. Recommend a legal five-Member team, Leader/Outfit, Bloom investment, and left-to-right skill order from an owned roster.

The product has a usable v0.1 vertical slice. It contains the real pinned roster, local card artwork, mechanics and song data, a dense Prydwen-inspired navigation shell, combined Member/Leader Outfit records, native ranking snapshots, seven optimizer-backed guides, and a Bloom/Oshi-aware owned-roster calculator. The public interface does not expose the research workflow, internal process notes, rights warnings, synthetic records, or absolute Live Score claims.

The v0.1 product is already live and release-verified. Its remaining exactness work is deliberately scoped into a separate v0.2 certification epic: certify an aggregate optimum only for a fully declared input tuple, then report formation order as a conditional second-stage result. The current TypeScript branch-and-bound search is sound and exact when it finishes, and it is proven on reduced rosters, but it does not finish the full search within the declared runtime budget. A separate Rust implementation is retained only as a research prototype: its 100,000-case lower/central/upper corpus now matches the TypeScript evaluator at the six-decimal boundary, while the complete mechanic/metamorphic gate, full-scope proof, and independent certificate replay remain open. We have not promoted either path to a false “optimal” claim.

The corrected machine-generated status separates the already-live v0.1 product
from the open v0.2 certification work:

| Area | Current state |
| --- | --- |
| Data, mechanics, evaluator, song corpus, UI, ranking output, guides, calculator, and QA | Implemented and verified according to their ticket evidence |
| v0.1 product | **100.0% verified and live**, including the bounded calculator disclosure and Pages smoke checks |
| v0.2 exact certification | **55.0% verified**; X01–X03 are complete, X04 execution is blocked behind active X05 performance architecture, and its certificate state is not eligible |
| Full-roster exact proof | Open; no public global-optimum claim is made |

The recommendation is to preserve the live v0.1 product and its guarded future
deployment workflow while completing v0.2 as an independently reviewable
certification effort. Exact optimization is not a prerequisite for the historical
v0.1 release.

## 2. North-star requirements

The project charter in `AGENTS.md` and `.codex/epics/yagoo-dori-v1/epic.md` defines the following non-negotiables:

- Optimize public screens for game decisions: find a card, understand its mechanics, compare it, and build a legal team.
- Use Prydwen as an information-architecture and density benchmark, while keeping Yagoo-dori’s branding, code, motion, and visual language original.
- Model the real game structure: one Leader/Outfit plus five unique-talent Member cards; Performance, Technique, Sense; Cute, Pure, Happy; Active, Passive, Special, Leader skills; triggers, target limits, progression, Bloom, and formation order.
- Never expose fabricated cards, invented mechanics, arbitrary scores, or fake precision.
- Keep the exact sentence below once, as a small muted footer line:

  > Unofficial fan site; not affiliated with COVER Corp. or QualiArts.

- Keep provenance and internal review state backstage or on an optional source page; do not turn repository instructions into product copy.
- Do not use private APIs, installed game files, account automation, client extraction/decryption, or scrape-protection bypasses.
- Keep future GitHub Pages replacements behind the two owner-controlled workflow
  gates; the historical v0.1 deployment is already public.

These requirements are important to the remaining plan: a fast but semantically incomplete solver is not a completion of the objective, and a release that hides uncertainty would be a regression even if the UI looks finished.

## 3. What has been completed

### 3.1 Real data and evidence pipeline

The runtime roster is no longer a fixture or illustrative dataset.

- **54 talents** are represented.
- **59 five-star Member cards** and **54 four-star Member cards** are represented.
- **113 Leader Outfits** are linked to the card/talent records.
- English HolodoriDB input is pinned to commit `1907a1b9f85beb22e9d255686a26e0bd5db223e9`.
- Japanese HolodoriDB input is pinned to commit `d8929f3cf6845111eeb6fc96f7b12bffb23ecd78`.
- The mechanics catalog validates **113/113 cards mapped** with **0 unresolved references**.
- The song corpus contains **177 songs** and **708 aggregate chart contexts**.
- The exact public timing corpus contains **704 available charts**, **4 unavailable tutorial-only charts**, **405,819 timed note events**, and **3,520 Special markers**.
- The frozen ranking benchmark contains **30 Expert charts** (70% frozen reference content and 30% current content).
- Seven generated guides and 33 published guide-chart contexts are validated.

Every normalized record retains source, retrieval/version boundary, patch or corpus identity, verification state, and transformation metadata in the data manifests and generated snapshots. Conflicting or unresolved runtime interpretations are not silently collapsed into a public fact.

### 3.2 Artwork and asset handling

The site serves local artwork rather than hotlinking production UI images.

- 113 local card icons are validated at **300 × 300**.
- 113 local card illustrations are validated at **2,282 × 1,284 or larger**.
- 113 deterministic listing previews are validated at **1,024 × 576**.
- Asset manifests retain local paths, source URLs, retrieval information, card identity, and hashes.
- `pnpm assets:check` fails on missing mappings, duplicate identity, invalid dimensions, or missing provenance.
- The public UI contains no “Art pending rights” labels, rights badges, permission requests, or provenance warnings.

### 3.3 Mechanics and evaluator

`packages/core/src/formation-evaluator.ts` and the native utility modules implement the modeled decision basis:

- Legal formation validation for one Leader/Outfit and five ordered, unique-talent Members.
- Exact card progression for low investment, one-copy maximum, duplicate-enabled ceiling, and explicit Bloom stages 0–5.
- Parameter calculation for Performance, Technique, and Sense, including pinned progression endpoints.
- Active, Passive, Special, and Leader/Outfit effect records with channels, effect families, combination semantics, trigger groups, targets, counts, probabilities, cooldowns, durations, and supported target selectors.
- Trigger evaluation for combo, Life, deck attribute, deck character group, Leader character/group, judgement, and music-character conditions where the pinned evidence permits a decision.
- Explicit enumeration of capped recipient alternatives. The central relative value uses the guaranteed minimum recipient allocation; the upper interval retains the maximum legal allocation. No unknown deterministic recipient priority is invented.
- Neutral Board/account assumptions for the public benchmark. Connect/Board contributions are represented but not treated as a hidden universal bonus.
- A single canonical central path (`evaluateNativeCentralUtility`) that delegates to the interval evaluator’s central component; lower/central/upper outputs are compared at signed integer micro-unit precision in the compiled parity harness.
- Modeled Active timing over uniform aggregate notes and exact chart timing when the pinned timeline exists.
- Timing-agnostic Special duration coverage where marker evidence is unavailable; exact marker-aware placement where it is available.

The runtime score equation, factor order, rounding behavior, and complete capped-recipient resolver remain incomplete in public evidence. Consequently, the product publishes **comparative relative utility under named assumptions**, not an absolute Live Score. This is an intentional scientific boundary, not an omitted feature.

### 3.4 Native ranking system

The ranking engine is independent of AppMedia, Game8, or another site’s tier labels. Editorial pages are allowed as evidence cross-checks, never as native score inputs.

The current ranking model computes matched-context card contributions using four native measures:

- `G`: mean marginal contribution across matched legal team substitutions.
- `P`: mean of the top 10% of contributions, measuring synergy ceiling without relying on one maximum.
- `B`: breadth, measuring how often a containing optimized team is within 5% of the best legal team in the context.
- `E`: normalized investment-efficiency area under the contribution-versus-investment curve.

The frozen baseline uses robust median/MAD normalization so a future outlier does not rescale every existing card. Methodology versions and game-patch versions are separate. Tier confidence gates, hysteresis, provisional reasons, and score/rank/tier delta attribution are implemented and tested.

The current generated snapshot covers both Member and Leader Outfit contexts, three investment lenses, 30 matched benchmark charts, 113 cards, deterministic bootstrap intervals, and no absolute-score claim. The public tier matrix is differentiated: the default browser regression currently observes **0 SS, 18 S, 23 A, 18 B, 54 C, and 0 D** entries for the tested context rather than placing the whole roster into one tier.

### 3.5 Guides and owned-roster calculator

Seven exact-card guides are generated from the native data contract. Each guide includes:

- An exact 5★ anchor Member card.
- A separately identified Leader/Outfit source.
- Premium, standard, and four-star-accessible legal formations.
- Replacement candidates and modeled replacement losses.
- Leader versus Passive source attribution, including same-talent card collisions.
- Progression/Bloom assumptions and investment order.
- Skill cadence, timing, chart fit, evidence grade, and citations.
- Song-specific comparisons over the pinned chart/timeline corpus.

The owned-roster calculator includes the user-requested key behavior:

- Exact card ownership, not just talent ownership.
- Independent Bloom 0–5 selection, defaulting to Bloom 0 for new cards.
- Owned eligibility for both Member and Leader/Outfit roles.
- Persistent local roster storage with versioned IDs and stale-ID sanitization.
- A cancellable browser Worker, so large calculations do not block the React/UI thread.
- A default 30-chart benchmark rather than a single arbitrary song.
- Oshi mode with `Member`, `Leader Outfit`, or `both` constraints.
- All 120 left-to-right placements evaluated after team selection using selected Bloom skill levels, Active cadence/probability, Special coverage, combo gates, persistent support, clipping, and exact timing where available.
- Deterministic relative utility and bounded replacement losses without an absolute Live Score claim.

The calculator is intentionally honest in its current UI and README: it is deterministic and bounded, not a certified full-roster global optimizer.

### 3.6 Application shell and public routes

The public application is a repository-subpath-safe Next.js static export with a persistent grouped sidebar on desktop and an accessible mobile drawer. Main route families include:

- `/cards` and `/cards/[slug]`
- `/leaders` and `/leaders/[slug]`
- `/talents` and `/talents/[slug]`
- `/tier-list`
- `/team-builder`
- `/guides` and `/guides/[slug]`
- `/skills/[slug]`
- `/synergies/[slug]`
- `/changelog/[snapshot]`
- `/methodology`
- `/sources`
- `/healthz`

Filters are URL-backed, art is the primary scanning unit, keyboard navigation and reduced-motion behavior are tested, and responsive images are used. Member cards and Leader Outfits share one database/product flow rather than being presented as two unrelated systems.

### 3.7 Release and quality work

The latest GitHub Verify run is successful:

- **Run:** [30737779243](https://github.com/asciisyaez/yagoo-dori/actions/runs/30737779243)
- **Commit:** `77cffa155db5f7ee53f665540b30a157bf86a810`
- Frozen install, production audit, lint, typecheck, tests, asset validation, data validation, production build, Chromium setup, browser E2E, Pages build, and Pages static E2E all passed.

The current local chain also passes the repository order in `AGENTS.md` through `pnpm test:e2e` and `pnpm project:status`. The browser suite reports **59 passed and 3 skipped**. The latest data validation reports the roster, mechanics, songs, exact timelines, rankings, and seven guides as valid.

The Pages workflow remains intentionally gated by two owner-controlled Actions
variables. The v0.1 deployment is already live; the gates protect future
replacements. No repository setting, secret, variable, Pages source, or
deployment state was changed by this implementation phase.

## 4. Architecture at the current checkpoint

```text
Pinned public inputs and manifests
        │
        ▼
data/public + data/mechanics + data/songs + data/generated
        │
        ▼
packages/core
  ├─ formation-evaluator       legal mechanics and progression
  ├─ native-utility             central/relative modeled utility
  ├─ native-ranking-*           metrics, baselines, tiers, changelogs
  ├─ native-guide-*             generated guide contract and validation
  ├─ formation-order-recommender exact 120-order placement analysis
  ├─ native-global-bound        sound optimistic subtree bounds
  └─ native-global-search       exact reduced / bounded global traversal
        │
        ▼
apps/web
  ├─ static database and profile routes
  ├─ tier matrix and URL filters
  ├─ guide pages
  └─ Worker-backed owned-roster calculator
        │
        ▼
pnpm build:pages → apps/web/out → gated GitHub Pages deployment
```

The source of truth for the epic and its dependency graph is `.codex/epics/yagoo-dori-v1/`. The source of truth for the release handoff is `docs/release.md`.

## 5. Current milestone ledger

The project status command calculates progress from weighted ticket criteria. A ticket’s completed-looking checklist is not credited until its dependencies and required evidence are valid.

| Milestone | Weight | Current status | Verified contribution | Notes |
| --- | ---: | --- | ---: | --- |
| N01 North-Star reset | 5% | done | 5% | Charter, scope, honest reset |
| N02 Real data and assets | 25% | done | 25% | Complete pinned roster and local artwork |
| N03A Mechanics evidence | 4% | done | 4% | Source-linked catalog and schemas |
| N03B Deterministic evaluator | 7% | done | 7% | Legal formations, skills, progression, intervals |
| N03C Song/chart contexts | 3% | done | 3% | Aggregate and exact timing corpus |
| N03D Native rubric/tier snapshot | 6% | done, 6/6 | 6% | Full-roster certification moved to v0.2 |
| N04 Application shell | 15% | done | 15% | Public UI, routes, responsive behavior |
| N05 Tier list | 10% | done, 6/6 | 10% | Ranking validation is independent of unrestricted certification |
| N06A Combined database polish | 5% | done | 5% | One Member/Outfit product flow |
| N06B Optimizer guides | 7% | done, 6/6 | 7% | Each guide retains its declared bounded/exhaustive scope |
| N06C Owned-roster calculator | 8% | done, 10/10 | 8% | Large arbitrary rosters remain bounded |
| N07 QA and Pages release | 5% | done, 8/8 | 5% | v0.1 is already live and smoke-verified |
| **v0.1 total** | **100%** | **100.0% verified** | **100%** | Separate from v0.2 certification |

## 6. The remaining blocker in technical detail

### 6.1 What must be proven in v0.2

The v0.2 exact epic requires a declared aggregate certificate to evaluate legal
five-card teams and eligible Leaders/Outfits for the exact tuple in its scope.
The v0.1 calculator and guides do not inherit that certificate and continue to
declare exhaustive or bounded search per request.

For the full current roster, the independently counted legal Member team space is:

> **126,445,821 legal five-card team sets**

The native search can collapse equivalent Leader/Outfit effects for exact screening, but it still must preserve a proof that every legal team set is either exact-evaluated or safely pruned by an upper bound below the incumbent.

### 6.2 What already works

- The canonical TypeScript central path and interval evaluator share one operation/rounding boundary and are exercised on chart, investment, Bloom, and reduced-roster fixtures.
- The TypeScript branch-and-bound bound is conservative and has reduced-roster tests that verify every legal completion lies below the bound.
- The search reconciles exact leaves plus pruned team sets to the independently counted legal team total on reduced fixtures.
- Leader equivalence classes reduce redundant Leader evaluations without changing the central result.
- The search exposes timeouts as non-certificates rather than returning a heuristic result with an “optimal” label.
- The complete declared scope has a canonical 864-range shard plan covering all **126,445,821** legal Member teams. The plan has contiguous ordinal ranges, stable talent prefixes, and SHA-256 resume tokens, but every range is explicitly still unsearched.
- A reduced aggregation probe groups only identical chart-specific resolved Leader application graphs. Its 1,808 lower/central/upper comparisons match the TypeScript reference exactly and it reduces representative utility calls by 48.67% in that sample; resolution cost and full mechanic coverage are still open.
- The trace-preserving compiled path now has a deterministic 100,000-input lower/central/upper comparison against forced-uncompressed evaluation with zero endpoint mismatches, fallbacks, and direct-reference mismatches. The full root ledger also covers all 113 singleton-safe Leader classes over 113 Members and 30 charts; it produced zero strict root prunes against the bounded incumbent.

### 6.3 Why the full proof remains open

The sound upper bound still relaxes several components independently. At the full roster root, the upper bound remains materially above the best known incumbent, so branch-and-bound cannot prune enough of the 126-million-team space within the declared runtime budget. The current prototype in `tools/exact-global-solver/` is a Rust compiled-kernel experiment, not a solution:

- Its README explicitly marks it `certificateEligible: false`.
- It does not yet implement every formation-evaluator rule, including all unresolved-trigger and recipient-resolution semantics.
- Its 100,000-case lower/central/upper corpus now matches TypeScript exactly; trace-preserving compression evidence is still not copied into rankings, guides, or calculator results.
- The full-scope shard plan is not a solver run: it is an execution contract, not a result, and cannot be reduced into a certificate until every range is exact-evaluated or safely pruned.
- A 32-shard A/B/C stratified pilot has exact winner parity and real 8/16/32-worker replays, but its selected p95 no-pruning model is still 36,624.16 core-hours before unmeasured full B0 scaling. It is a no-go result, not a global-search certificate.
- The aggregation probe is parity-valid only for its declared reduced sample. It must pass the complete mechanic/Bloom/investment/singer/fallback corpus and an independent reduced brute-force winner check before reuse.
- A prototype speed-up without evaluator parity would create a false completion, so it is intentionally quarantined.

Those v0.1 product tickets are already independently complete. The remaining blocker is scoped to the v0.2 exact-certification tickets and does not invalidate the live bounded product.

## 7. Proposed path from 55% to 100%

The following plan preserves the North Star and makes the remaining work measurable.

### Phase A — Build a certifiable exact kernel

**Objective:** produce an optimized evaluator whose result is demonstrably identical to `evaluateNativeCentralUtility` for the complete mechanic catalog.

1. Keep the checked-in compact kernel and 100,000-case lower/central/upper parity corpus as an evaluator gate, not a production claim.
2. Complete the remaining stratified parity extensions: every mechanic family, trigger pass/fail, target cap, override mode, Bloom stage, investment lens, singer state, same-talent collision, and five-star cap behavior.
3. Require exact equality of lower, central, and upper signed micro-units against the TypeScript reference; any mismatch keeps `certificateEligible=false`.
4. Benchmark serial, parallel, resolution-cache, and aggregation implementations on reduced rosters and record throughput, memory, and byte-identical manifests.

**Exit evidence:** a versioned kernel manifest, differential test report covering all 113 cards and all mechanic families, and a compiled evaluator whose output matches the TypeScript evaluator on the complete fixture set.

### Phase B — Certify the full search

**Objective:** prove the best legal team under the declared relative model, not merely find a good team.

1. Use `data/native/exact-optimizer-full-shard-plan-v1.json` to enumerate the full legal search space using stable talent/card ordering and resumable ordinal ranges.
2. Use a high-quality incumbent only as a lower bound; never use it to skip proof work.
3. Preserve one-card-per-talent and five-star constraints in every branch or meet-in-the-middle state.
4. Evaluate the full frozen 30-chart benchmark and all eligible Leader/Outfit classes, using only aggregation proven against the TypeScript reference.
5. Treat formation order as an exact post-selection finalist comparison over all 120 permutations where the model has timing evidence.
6. Reconcile:
   - `exactLeafEvaluations + prunedTeamSets == legalTeamSets`
   - `legalTeamSets == 126,445,821` for the unrestricted roster
   - `optimalityGap == 0`
   - every pruned subtree’s upper bound is strictly below the incumbent at the comparison precision.
7. Emit a versioned, content-addressed SHA-256 certificate manifest with source commits, methodology version, seed, chart corpus, roster count, bound version, winner/tie set, and timing summary. Do not describe it as cryptographically signed unless a real signing identity and verification path are added.

The preferred implementation is a specialized compiled solver or meet-in-the-middle search **only if** it passes Phase A. A faster but semantically incomplete evaluator is not an acceptable substitute.

### Phase C — Integrate and regenerate

Once Phase B is complete:

- Promote the exact solver from prototype to a reviewed core/tool path.
- Add the certificate to `data/native/` and validate it in `pnpm data:validate`.
- Regenerate native rankings, changelog attribution, all seven guides, and calculator benchmark outputs from the fixed methodology and seed.
- Keep bounded search as a clearly labeled fallback for arbitrary user-owned subsets that are not covered by the full certificate; never present a fallback as globally optimal.
- Add browser and core regressions proving that an exact result shows its certificate state and a bounded result shows its bounded state.

### Phase D — Close v0.2 certification (v0.1 is already released)

After the certificate is integrated:

1. Close X01–X06 only when their scientific criteria and verifier evidence pass.
2. Re-run ranking/guide outputs only if evaluator, pinned inputs, benchmark, or methodology changes.
4. Re-run the entire AGENTS verification order, including `pnpm build:pages` and `pnpm test:e2e:pages`.
5. Re-run the public history, dependency, asset, and data audits.
6. Update the v0.2 status and content-addressed run record; do not rewrite v0.1 release history.
7. Ask the owner only if a later reviewed release should replace the live Pages artifact; use the guarded future-release checklist in `docs/release.md`.

## 8. Alternatives and trade-offs for advisor feedback

| Option | Benefit | Risk | Recommendation |
| --- | --- | --- | --- |
| Complete equivalent compiled exact solver | Preserves the requested mathematical/global claim and can improve runtime materially | Porting and differential testing are substantial; a hidden semantic mismatch would be dangerous | **Preferred** |
| Meet-in-the-middle with exact TypeScript-compatible feature states | Potentially reduces the combinatorial traversal while retaining a proof | Utility interactions may not decompose cleanly; requires a formal admissible bound | **Good fallback** |
| Strengthen TypeScript bounds only | Smallest code change and easy review | Current root gap suggests it may still not finish the full space; can spend time without resolving the core issue | Use only as a measured sub-experiment |
| Ship the current bounded calculator and call the project complete | Fastest public release | Directly contradicts N03D/N06C acceptance and the user’s requirement for mathematically optimal recommendations | **Do not use for 100%** |
| Replace the relative model with an invented absolute score equation | Could look more precise | Violates the evidence boundary and creates fake precision | **Rejected** |

## 9. Decisions requested from the advisor

The implementation can continue without changing the current product direction, but the following decisions would materially affect the remaining work:

1. **Exactness gate:** Should full-roster certification remain a hard pre-release gate, as the current epic says? The recommendation is yes.
2. **Search scope:** Should the certificate cover the full 113-card roster and 30-chart benchmark, with all 120 formation orders evaluated for finalists, or is a formally documented subset acceptable? The current plan assumes full scope.
3. **Runtime budget:** What offline certification runtime and memory budget are acceptable for a release artifact? This determines whether a parallel Rust/WASM path or a more elaborate meet-in-the-middle design is justified.
4. **Model boundary:** Is the current “relative utility under explicit neutral assumptions” acceptable while the undocumented Unit Score equation remains unavailable? This is the only honest option under current durable public evidence.
5. **Pages timing:** v0.1 is already public with its bounded-search disclosure. Future replacements remain owner-gated independently of v0.2 certification.
6. **Future personalization:** Should account-specific Board/Connect/collection bonuses remain a post-v1 feature? They are represented as boundaries now and should not be silently folded into a universal tier.

## 10. Evidence index for review

| Evidence | Location |
| --- | --- |
| Repository charter and required verification | `AGENTS.md` |
| Product scope, ticket graph, accuracy boundary | `.codex/epics/yagoo-dori-v1/epic.md` |
| v0.1/v0.2 status and migration | `.codex/epics/yagoo-dori-v1/status.json`, `.codex/epics/yagoo-dori-v0.2-exact/`, `pnpm project:status` |
| v0.2 specification and proof limitation | `docs/exact-optimizer-spec.md`, `.codex/epics/yagoo-dori-v0.2-exact/` |
| v0.1 calculator acceptance and scope disclosures | `.codex/epics/yagoo-dori-v1/tickets/N06C-owned-roster-calculator.md` |
| N07 QA/release gates | `.codex/epics/yagoo-dori-v1/tickets/N07-qa-release.md` |
| Source and schema policy | `docs/source-policy.md`, `docs/data-dictionary.md` |
| GitHub Pages activation and rollback | `docs/release.md` |
| Pinned public/mechanics/songs/timelines | `data/generated/`, `data/native/`, `data/sources.json` |
| Native evaluator and utility | `packages/core/src/formation-evaluator.ts`, `packages/core/src/native-utility.ts` |
| Native ranking and tier logic | `packages/core/src/native-ranking-*`, `packages/core/src/native-tier-calibration.ts` |
| Exact reduced/global search | `packages/core/src/native-global-bound.ts`, `packages/core/src/native-global-search.ts` |
| Exact timing/placement | `packages/core/src/formation-order-recommender.ts`, `data/generated/holodori-chart-timelines.json` |
| Guides and calculator | `packages/core/src/native-guide-*`, `packages/core/src/team-calculator.ts`, `apps/web/src/components/team-calculator.tsx` |
| Compiled solver boundary | `tools/exact-global-solver/README.md` |
| Full-scope shard contract | `docs/exact-optimizer-sharding.md`, `data/native/exact-optimizer-full-shard-plan-v1.json` |
| Leader-resolution aggregation probe | `docs/exact-optimizer-aggregation.md`, `data/native/exact-optimizer-leader-aggregation-benchmark-v1.json` |
| Latest CI evidence | [Verify run 30737779243](https://github.com/asciisyaez/yagoo-dori/actions/runs/30737779243) |

## 11. Definition of “100% complete”

The project should be marked complete only when all of the following are true in current repository evidence:

- `pnpm project:status` reports v0.1 100.0% and a separate v0.2 state.
- X01–X06 are checked with a current full-roster certificate whose scope hash matches the request.
- Arbitrary owned-roster and guide requests remain bounded unless separately certified.
- Native rankings and guides are regenerated from the final pinned data/methodology versions.
- The calculator distinguishes certified exact results from any bounded fallback and retains Bloom/Oshi/timing behavior.
- The full verification order in `AGENTS.md` passes, including both Pages export and Pages static E2E.
- The public history and future-release checklist are reviewed only when the owner authorizes a replacement Pages deployment; v0.1 already passes live smoke checks.
- No public page contains synthetic records, internal workflow text, prominent process/legal clutter, unlicensed hotlinks, absolute-score claims unsupported by evidence, or a false global-optimum label.

Until the v0.2 criteria are met, the correct status is **v0.1 live with v0.2 exact certification open**, not a false global-optimum claim.
