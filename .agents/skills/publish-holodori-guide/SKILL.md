---
name: publish-holodori-guide
description: Draft and locally preview an evidence-backed hololive Dreams team guide anchored to one exact 5-star Member card and one exact Leader/Outfit. Use for requests such as "Create a Pekora build," "make a guide for this 5-star card," or "compare premium and accessible teams." Use the real current roster and mechanics, evaluate legal formation order, and never publish automatically.
---

# Draft a Holodori guide

Create a useful guide draft from the real normalized dataset.

## Workflow

1. Run `pnpm project:status` and read `AGENTS.md`.
2. Resolve the exact 5★ card and exact Leader/Outfit. If a talent has multiple matching cards or outfits, show the candidates and ask for the intended record.
3. Confirm the current engine models the actual game mechanics required for the request. Do not use the legacy synthetic optimizer.
4. Enforce one Leader/Outfit plus five Member cards, no duplicate Member-card talent, and every known legal formation constraint.
5. Evaluate all 120 left-to-right Member orders for finalists. Model real stats, skill levels, triggers, probabilities, cooldowns, durations, target limits/order, full-Life/combo conditions, and Leader/Member separation.
6. Produce premium, standard, and 4★-accessible formations with projected replacement losses, skill timing, chart fit, investment order, evidence, citations, and a guide changelog.
7. Distinguish verified calculations from source-attributed editorial judgments. If a required mechanic is not implemented or evidenced, state the exact gap instead of inventing an answer.
8. Generate a validated MDX draft and local browser preview. Run relevant verification and present it for review; do not commit or publish automatically.

## Refuse

- Private game access, client extraction, account automation, or scrape-protection bypass.
- Synthetic roster data, invented scores, illegal teams, or untested formation assumptions.
- Automatic publication.

The legacy `draft-guide.ts` helper predates the North-Star reset and must not be used until N03 replaces its engine.
