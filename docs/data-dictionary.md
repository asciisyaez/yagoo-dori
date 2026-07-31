# Data dictionary

## Shared evidence fields

| Field | Meaning |
|---|---|
| `id` | Stable, human-readable local identifier. |
| `slug` | Stable route key; never inferred from a translated display name. |
| `sourceIds` | References into `data/sources.json`. |
| `retrievedAt` | ISO date when the evidence was checked. |
| `patchId` | Game-state identifier, separate from methodology. |
| `verificationState` | `verified`, `corroborated`, `research-only`, or `disputed`. |
| `confidence` | Evidence confidence from 0 through 1, not tier probability. |
| `illustrative` | True when a value exists only to exercise the pipeline. |

## Core records

- `Talent` is the performer identity. It is not ranked as a card.
- `MemberCard` occupies one of five Member slots. It has a rarity, score type, progression curve, and skill references.
- `LeaderOutfit` is the selected Leader/Outfit and does not occupy a Member slot.
- `SkillEffect` records activation condition, probability, duration, timing window, target, effect kind, and value.
- `PatchSnapshot` describes the game patch and source boundary.
- `RankingSnapshot` pins patch, methodology, lens, chart corpus, fixed seed, frozen baseline, generated metrics, and uncertainty.
- `TeamGuide` anchors an exact 5-star Member card and exact Leader/Outfit, then supplies premium, standard, and accessible five-card formations.
- `DatasetManifest` pins the intended rarity scope, observed fixture counts, and independently verified expected launch counts. Null expected counts force the production gate closed.
- `ReviewQueueRecord` preserves conflicting claims and forbids an open item from carrying a silent resolution.

## Ranking metrics

`G` is mean Shapley marginal contribution across matched legal teams. `P` is the mean of the top 10% of those contributions. `B` is the share of contexts where the optimized containing team is within 5% of the best legal team. `E` is normalized area under the contribution-versus-investment curve.

Frozen median/MAD values are versioned inside the methodology definition. They do not change when a new card is appended. A methodology update creates a new identifier and changelog boundary.
