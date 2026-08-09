---
name: publish-holodori-guide
description: Draft and locally preview a hololive Dreams team guide anchored to one exact 5-star Member card. Use for requests such as "Create a Pekora build," "make a guide for this 5-star card," or "compare premium and accessible teams." Search the real roster and mechanics, evaluate legal formations and song contexts, and never publish automatically.
---

# Draft a hololive Dreams team guide

Build the guide from Yagoo-dori's native evaluator and pinned game data. Other guide sites may help verify mechanics, but their tiers, teams, or prose never enter the calculation or draft.

## Resolve the request

1. Run `pnpm project:status` and read `AGENTS.md`.
2. Resolve the talent name to one exact 5★ Member card. Ask only when more than one card matches the request.
3. If the request names a Leader Outfit, resolve it to the exact card/Outfit and add it as a search constraint. Otherwise let the native search compare eligible Leader Outfits.
4. Confirm the anchor, roster snapshot, mechanics snapshot, and song contexts before calculating anything.
5. For an account-specific guide, require owned cards, Member Upgrade Bonus, Board nodes, Connect placement, platform, and execution assumptions. Otherwise use the frozen neutral public benchmark and do not call it universally optimal.

## Calculate the formations

1. Enforce one Leader Outfit plus five Member cards, one Member card per Holomem, the exact anchor, and every known legal constraint.
2. Use the current native utility engine. It must account for real Performance/Technique/Sense parameters, investment, attributes and generations, Leader/Passive targets, Active probability/cooldown/duration, Special effects, full-Life/combo triggers, and chart duration/note count.
3. Search premium, one-copy standard, and 4★-accessible pools. The accessible pool keeps the exact 5★ anchor, four 4★ Members, and a 4★ Leader Outfit.
4. Enumerate all 120 left-to-right Member-slot orders for every audited finalist. Until exact Special markers and recipient priority are proven, record order as indeterminate rather than assigning a synthetic timing advantage.
5. Re-run the standard pool for every relevant rating-eligible song. Keep a chart alternative only when its full modeled interval beats the reference formation; never infer an order-only change from aggregate chart data.
6. Calculate replacements by re-evaluating legal swaps in the same chart context. Report the relative-utility loss as an interval rather than an invented absolute Live Score.
7. Preserve the search certificate. A locally fixed-point heuristic result is a recommended model result, not a proof of global optimality. Reserve "mathematically optimal" for an exhaustive, branch-and-bound, MILP, or independently checked proof.

## Bootstrap the guide timeline projection

1. Before generation, run `pnpm --filter @yagoo-dori/core timelines:project:guides --anchor-card-id=<exact 5-star card ID>` for every requested new anchor. Add `--leader-outfit-card-id=<exact card ID>` when the request fixes a Leader Outfit.
2. Accept the indeterminate fallback only when the projection explicitly records a required Expert chart as unavailable. Stop on an unknown or missing projection key; never infer that absence means unavailability.
3. For an unavailable chart, publish aggregate formation comparison only. Keep a chart alternative only when its full modeled utility interval strictly dominates the reference formation. Mark order indeterminate, make no song-specific placement claim, and verify the row contains no order-only change.

## Generate and review

1. Run `pnpm --filter @yagoo-dori/core guides:generate --generated-at=<fixed ISO timestamp> --anchor-card-id=<exact 5-star card ID>`. Add `--leader-outfit-card-id=<exact card ID>` only when the request fixes a Leader Outfit. Do not hand-edit generated calculations.
2. Run `pnpm data:validate`, `pnpm --filter @yagoo-dori/core test`, and `pnpm --filter @yagoo-dori/web typecheck`.
3. Preview `/guides` and `/guides/<slug>` on desktop and mobile. Verify the exact anchor, Leader Outfit, five Member slots, three investment builds, modeled skill coverage, recipient intervals, replacements, chart variants, account-state assumptions, and search certificate.
4. Present the generated diff and preview for review. Never commit, deploy, or publish unless the user separately requests it.

## Stop instead of guessing

- Do not use private APIs, client extraction, installed game files, account automation, or scrape-protection bypass.
- Do not fill missing mechanics with editorial tier labels, arbitrary weights, synthetic cards, or copied teams.
- If a required target-order or runtime rule is unresolved, keep its interval/qualifier in the calculation and state the exact limitation in the review report.
