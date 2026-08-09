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

`G` is the mean matched marginal from legal comparison teams; it is not a Shapley value or an additive Member share. `P` is the mean of the top 10% of those contributions. `B` is the share of contexts where candidate team utility is at least 95% of the strongest matched legal team. `E` is the trapezoidal mean `(G_low + 2*G_standard + G_max)/4`.

Frozen median/MAD values are versioned inside the methodology definition. They do not change when a new card is appended. A methodology update creates a new identifier and changelog boundary.

## holomem Board mechanics catalogs

`data/generated/holodori-mechanics.json` keeps payload `schemaVersion: 1` and uses
`methodologyVersion: "yd-mechanics-catalog-1.1.0"` for the Board metadata extension. Every row is
linked to a pinned HolodoriDB file through `sourceRef`; the two independent corroboration sources are
`appmedia:board-guide` and `game8:board-connect`.

- `boardNodes` (323 rows) contains the existing node identity plus `pointCost`, item resource costs,
  player-level view/unlock condition IDs, and the upstream `autoSelectionPriority`.
- `boardNodePositions` (608 rows) maps the 152 node groups into each of four tree models. Validation
  derives orthogonal unit-neighbor edges from these coordinates. The resulting 171-edge graph is
  identical and connected from `S-001` in all four models; this is a corroborated derivation, not a
  published prerequisite table.
- `boardPointPools` (54 rows) provides one independent Board Pt pool per current talent, with its
  nullable translated name. `holomemRankPoints` (50 rows) stores per-rank income from the single
  pinned `level-group-1`; cumulative income at rank 50 is 361 points.
- `boardNodeConditions` (5 rows) resolves only the conditions referenced by nodes. The sync validates
  the upstream condition type and MIN semantics, then records the real threshold as
  `player-level-at-least`; thresholds are never parsed from condition IDs.

The row cost histogram is `{0:1,1:25,2:98,3:103,4:12,5:80,6:4}`. Resolving one applicable variant per
group and talent yields a uniform 447-point whole-board cost and 301-point Leader + Card + Connection
subtotal for all 54 talents. Rank income alone therefore leaves an 86-point whole-board gap. Additional
achievement or exchange-shop income is an unresolved, user-declared budget extension; the catalog does
not quantify it.

Five non-scoring runtime rules bound later Board tooling: derived adjacency is corroborated; rank income
and per-talent pools are verified; achievement income is unresolved; cross-board Connect-card reuse is
corroborated while simultaneous active-unit coexistence is undocumented; and Board stat stacking is
unresolved. Recommendations must use a conservative envelope and must not claim absolute totals or
jointly attainable stacking. These Board rules do not alter the certified `declared-neutral-board-v1`
calculator scope.
