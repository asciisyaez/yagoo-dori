# Exact optimizer fixed-Leader partial state

**Status:** Implemented and exhaustively validated on the pinned reduced
scope (2026-08-04). The schema below is implemented in
`packages/core/src/exact-optimizer-partial-state.ts`; the Section 6 protocol
was executed in full by `pnpm optimizer:suffix:validation` with zero
mismatches and a reproducible stable digest
(`data/native/exact-optimizer-suffix-validation-v1.json`, digest
`3dbda663…`). Zero distinct-history collision pairs were observed, so the
result proves resumption soundness only — no merge rule was exercised. This
document is still not a dominance proof, a full-roster claim, a certificate,
or performance credit.

The proposed state is deliberately conservative. It keeps the complete
continuation identity, uses explicit deferred phases where the current
recurrence cannot yet resolve a formation, and treats every omitted or
ambiguous dimension as non-mergeable. Sufficiency is claimed only over the
dimensions and values that the planned reduced-scope enumeration will actually
exercise. Nothing here reopens the dominance pilot or changes
`certificateEligible=false` or `fullRunAuthorized=false`.

## 1. Actual recurrence and the resume boundary

The current exact path has three semantic layers:

```text
ordered Member prefix / suffix
  -> complete ordered five-Member formation
  -> compileNativeUtilityTeamIntrinsic (Member-only timing layer)
  -> fixed-Leader resolution in evaluateFormation
  -> per-chart Active/Special/parameter preparation
  -> ordered lower/central/upper accumulation and canonical comparison
```

The source-level boundary is important:

1. `packages/core/src/exact-optimizer-kernel.ts` sorts and validates a
   complete five-card team in `compileExactOptimizerTeam`, then calls
   `compileNativeUtilityTeamIntrinsic` in
   `packages/core/src/native-utility.ts`. That intrinsic contains Member
   progression and Active timing, but intentionally no Leader-derived state.
2. `evaluateNativeRelativeUtilityWithCompiledTeam` verifies that the intrinsic
   matches the formation, then the native evaluator calls `assertLegalFormation`
   and `evaluateFormation`. Only with all five ordered Members present can it
   resolve Leader, Passive, Active, and Special applications, target
   alternatives, parameter effects, Persistent support, and Board/Connect
   contributions.
3. For the selected chart, the evaluator compiles Active profiles and Special
   support, creates source-order state runs, and evaluates the base,
   Special-support, and Special-activation passes. Each pass retains the
   left-to-right `sum += contribution` recurrence. The bulk transform may
   enclose repeated equal contributions, but it must certify the same ordered
   recurrence or fall back to ordered replay.
4. B3 materializes the complete lower/central/upper tuple. B2 is central-only:
   it may prune only a certified strict central micro-unit loss. Equality,
   fallback, and finalist cases promote to B3.

The recent `aggregateCompressedActiveCentral` change is part of this contract,
not an exemption from it. A compressed run computes all three lane
contributions and checks `lower <= central <= upper` at the first and last
notes before it certifies the run; a violation falls back to ordered replay.
This is the clamp-identity guard recorded as Decision D-5.

### Planned state-only API boundary

The implementation phase may expose a function with a shape equivalent to:

```text
resumeExactOptimizerSuffix(serializedPartialState, serializedSuffix)
```

Its only dynamic inputs are the canonical serialized state and the canonical
suffix. It must not accept `FormationInput`, `ExactOptimizerTeam`, the original
Member objects, a prefix array owned by the caller, or any other full-formation
reference object. It must not call or transitively invoke the reference
formation-evaluation entry points (`evaluateFormation`,
`evaluateNativeRelativeUtility`, `evaluateNativeRelativeUtilityUncompressed`,
`evaluateNativeRelativeUtilityWithCompiledTeam`, or the kernel B3 wrapper).

The state-only implementation may decode the card IDs, investment values,
Bloom stages, and scalar ledgers that are already present in the serialized
state and may consult the pinned read-only catalog. It may not reconstruct the
original prefix object graph and pass it to the reference evaluator. A
validation-time dependency boundary must make that prohibition observable.

The resume boundary has two legal phases:

| Phase | What is available | Required continuation behavior |
| --- | --- | --- |
| `formation-incomplete` | Fixed Leader, ordered Member prefix, legality ledgers, and the exact remaining action set | Do not invent Leader recipients or prefix score contributions. Append only the supplied legal suffix; all Leader-dependent resolution remains explicitly deferred. The per-chart accumulator is `not-started` at source position zero. |
| `post-leader-resolution` or `per-chart-accumulation` | A complete ordered formation plus the resolved fixed-Leader graph and all chart-specific ledgers | Continue from the serialized fixed-Leader resolution or from the serialized per-pass accumulator checkpoint. The checkpoint includes source-order position and binary64 endpoint bits. |

This boundary follows the existing recurrence rather than pretending that a
Member-only prefix can already have the completed Leader's support or target
allocations. A prefix state at depth 0 through 4 therefore carries explicit
`deferred` sentinels for those fields. A state may carry a non-zero per-chart
accumulator only after fixed-Leader resolution has completed. This is a
conservative limitation, not a performance claim.

## 2. Proposed serialized state tuple

The exact field names are implementation work in Phase 3. The following tuple
is the contract that implementation must encode without silently dropping a
dimension:

```text
PartialState {
  schemaVersion,
  scope: { manifestId, scopeHash, seed, boardSignature, investmentSignature },
  fixedLeader: { cardId, talentId, triggerContextSignature },
  phase: formation-incomplete | post-leader-resolution | per-chart-accumulation,
  prefix: {
    depth,
    orderedMembers: [
      { slot, cardId, talentId, rarity, attribute, groups, investment, bloomStage }
    ],
    canonicalSortedMemberIds,
    remainingActionIds,
    suffixOrderingRule,
    selectedCount,
    remainingFiveStarBudget,
    talentIds,
    attributeCounts,
    groupCounts
  },
  chartContext: {
    chartKey, songId, expectedChartHash, singerTalentIds,
    fullComboNoteCount, playingMilliseconds, chartOrderSignature
  },
  memberFacts: {
    progressionStateAndParametersBySlot,
    activeTimingBySlot,
    activeValueAndProbabilityLedger
  },
  leaderAndTriggerFacts: {
    resolutionStatus,
    triggerTruthAndUnresolvedBranches,
    applicationAlternatives,
    cappedTargetEligibility,
    persistentSupport
  },
  specialFacts: {
    supportByNoteOrRun,
    activationRateByNoteOrRun,
    durationCoverage,
    unresolvedActivationBranches
  },
  arithmetic: {
    passOrder,
    runOrNoteCursor,
    lowerCentralUpperAccumulatorEnclosures,
    fallbackReason,
    clampAndCanonicalBoundaryStatus
  },
  comparison: {
    prefixTieKey,
    fullCandidateTieKeyOrDeferred,
    suffixIdentity,
    canonicalTupleOrDeferred,
    b2Status,
    b3PromotionReason,
    finalistStatus
  }
}
```

All map and array order is canonical. Each floating-point value used in an
identity or continuation fact is encoded by its exact IEEE-754 binary64 bit
pattern, represented as a fixed-width hexadecimal string. Decimal rendering
is diagnostic only. Signed zero, infinities, NaNs, outward endpoints, and
fallback status are not normalized away. Integer score outputs remain signed
six-decimal micro-units using the existing `Math.round(value * 1_000_000)`
boundary.

The `scope` signature includes the reduced manifest in Section 7 and the
methodology versions. A state from another chart, board, seed, investment
layer, Bloom map, or source revision is not equivalent, even if its current
central value happens to match.

For `formation-incomplete` states, all Leader-dependent and chart-dependent
fields remain present as tagged `deferred` values, not absent JSON keys. The
only permitted accumulator value in that phase is a point zero enclosure with
source position zero and `status: not-started`. For a completed formation,
`memberFacts`, `leaderAndTriggerFacts`, `specialFacts`, and `arithmetic` are
materialized before any state is eligible for an accumulator continuation.

## 3. Continuation-sensitive dimension checklist (DoD-3)

The following checklist is the sufficiency argument's complete dimension list.
Each item is either retained directly, derived only from retained fields under
the pinned rules, or made explicitly non-mergeable by a tagged singleton
state. There is no implicit "not relevant" omission.

| Dimension | State requirement and reason it is sufficient |
| --- | --- |
| Remaining action set | Retain the exact canonical remaining card IDs and the deterministic suffix-order rule. Removing one selected card or changing the legal successor set changes future legality, so a Member-count-only key is invalid. |
| Selected count | Retain prefix depth and selected count as exact integers. They determine slot availability and the terminal condition; depth is not inferred from a possibly sparse array. |
| Five-star budget | Retain the consumed and remaining five-star counts. The continuation rejects any suffix exceeding the scope cap, even when the selected card IDs otherwise match. |
| Card/talent identities | Retain every ordered slot's card ID and talent ID, the canonical sorted Member IDs, rarity, attributes, and groups. This preserves formation order, unique-talent legality, recipient eligibility, and the comparator key. |
| Bloom/investment | Retain the exact investment layer and Bloom stage for every selected Member, plus the fixed scope signature for unselected candidates. A card ID without progression state is not a sufficient identity. The Leader/Outfit is fixed by card ID; the reduced fixture supplies no separate Leader investment/Bloom argument. |
| Attribute/group counts | Retain exact counts and the identities from which they were derived. Counts are useful for legality and trigger checks, but identities remain mandatory because later target and tie behavior can distinguish equal counts. |
| Leader-trigger truth | Retain the fixed Leader ID, observation signature, every resolved boolean, every `unresolved` branch, and the exact application alternatives. Before five Members are present, use `resolutionStatus: deferred`; do not guess recipients or trigger truth. |
| Singer/chart signature | Retain chart key, expected chart hash, song ID, ordered singer talent IDs, note count, playing duration, and chart-order signature. A chart key alone is not enough to establish the source-order trace. |
| Capped-target eligibility | Retain per-effect eligible indices, alternative recipient sets, minimum/maximum counts, recipient intervals, status, source/effect IDs, and canonical alternative order. A recipient count or interval alone cannot reproduce later parameter or support values. |
| Member parameters | Retain per-slot progression level, parameter values, parameter-base/effect values used by the evaluator, and their exact source/investment provenance. These are the inputs to parameter-effect additions and base-total scaling. |
| Active timing/value/probability | Retain each Member's active level, cooldown, duration, base probability, check-count ledger, selected lower/central/upper values, and the exact per-note/run state sequence. The current intrinsic cache supplies timing only; Leader-resolved support and selected values remain formation-specific. |
| Persistent support | Retain each Member's lower/central/upper support interval plus its source and recipient ledger. A support total without its alternative and source order cannot prove the next Active contribution. |
| Special support/activation | Retain Special level, duration coverage, support and activation-rate values by note/run, alternatives, and unresolved/fallback status. Special subtraction, `max`, probability capping, and later canonical boundaries depend on these branches. |
| Ordered binary64 accumulator/enclosure state | For every lower, central, and upper pass, retain the pass identity, source-order note/run cursor, incoming enclosure endpoints, current endpoints, and fallback/transform status as binary64 bits. A state is mergeable at this boundary only at the same source-order position with identical endpoints; RN-even addition is not associative. |
| Canonical tie/finalist continuation | Retain the complete eventual tie key (`leaderCardId|sortedMemberCardIds`), ordered-prefix identity, remaining suffix identity, lower/central/upper micro-unit tuple when materialized, and B2/B3/finalist promotion status. Strict central loss is the only prune; equality, fallback, and finalist states remain B3 candidates. |

The fixed board/account state is also part of the scope signature and is not
re-derived from a caller. The state must carry the declared-neutral Board
identity and evidence reference used by the manifest.

## 4. The four missing proofs

The current feasibility artifact lists four reasons that the old idea was
killed before a pilot. The proposed state addresses them as follows.

### 4.1 Leader-specific continuation

The state is keyed by the concrete Leader/Outfit card ID and its trigger
observation context, never by a Member set or a Leader class bound. It retains
the ordered prefix, the fixed scope's Board and chart signatures, and the
complete unresolved/resolved application graph. For prefix depths below five,
Leader recipient and support fields are explicitly deferred because the
current `resolveLeaderApplications` path receives a complete
`LegalFormation`. Once a suffix completes the formation, the state-only
continuation compiler must resolve the concrete Leader against the exact
ordered five-card identity before starting any contribution accumulator.

Thus two states with different Leaders, trigger observations, unresolved
application alternatives, or Board signatures cannot merge. A Member-set
bound is not treated as a resume state and cannot satisfy this proof.

### 4.2 Complete branch and formation identity

The ordered prefix, card/talent identities, investment/Bloom state, attribute
and group ledgers, trigger assignments, capped-recipient alternatives, Active
selection sequence, and Special branches are all in the tuple. The remaining
action set and suffix rule preserve every legal completion. A state that cannot
materialize one of those facts is tagged `deferred` or `fallback` and is a
singleton for equivalence; it is never silently treated as equal to a resolved
state.

This covers the fact that the native evaluator derives note contributions from
the complete formation and chart timeline. Equal current central bounds do not
make two branches equivalent. The state must carry the branch identity that
can affect any later source-order note.

### 4.3 Enclosure and source-order preservation

The accepted bulk contract is a proof about a particular ordered binary64
recurrence, not a license to add a prefix and suffix in either order. Every
accumulator lane stores its incoming and current outward endpoints as exact
binary64 bits and stores the source-order cursor. The pass identity includes
base Active, Special-support Active, and Special-activation Active; later
Special subtraction/max, scaling, parameter-effect addition, clamping, and
canonical conversion are represented by their own continuation status.

Repeated-run compression is admitted only when its contribution is the same
at the run boundaries, its transformed enclosure is certified, and the
three-lane guard is satisfied. In particular, the current per-note
`lower <= central <= upper` check and its ordered-replay fallback are part of
the state identity. Any ambiguous component has the ordered-replay status and
cannot merge with a certified component.

The RN-even resolution is therefore: states are mergeable only when they have
the same source-order position and identical endpoint bit patterns for every
lane. Anything weaker is excluded from the merge relation and would require a
new arithmetic proof. The design does not claim that a numeric interval or a
canonical micro-unit bucket is enough.

### 4.4 Tie key and finalist promotion

The state retains the Leader ID, ordered prefix, canonical sorted Member IDs,
remaining suffix identity, and the eventual comparator key. At a complete
candidate it retains the ordered central/lower/upper micro-unit tuple and the
promotion status. The comparator remains:

```text
central micro-units, then lower, then upper, then
leaderCardId|sortedMemberCardIds (lexicographically smallest wins)
```

B2 can use only a certified strict central loss. A central equality, any
lower/upper ambiguity, any fallback, and every possible finalist promotion is
sent to B3 with the full tuple and tie key. No equality credit or partial
finalist claim is taken from this document.

## 5. Mergeability and equivalence

Let `H` be an ordered prefix history under one fixed reduced manifest, Leader,
chart, investment/Bloom configuration, Board, seed, and suffix-order policy.
Let `S(H)` be its canonical serialized state. The proposed continuation
equivalence is:

```text
S1 ≡ S2 iff
  canonicalBytes(S1) === canonicalBytes(S2)
  and both states have the same schema and manifest identity.
```

The byte equality expands to equality of every field in Sections 2 and 3,
including array order, tagged deferred/fallback status, source-order cursor,
binary64 endpoint bits, canonical alternatives, and tie/finalist status. It is
not equality of central values, intervals, rounded buckets, or a hash alone.
The hash is only an index; a collision requires canonical-byte comparison.

This relation is intentionally identity-like in the first implementation.
Because prefix card identities remain in the state, distinct histories will
normally not collide. A collision between distinct histories is a measured
event, not an expected benefit. If a future implementation wants to omit a
field and merge more histories, it must first prove that the field is a
function of the retained bytes for every legal suffix and then add a new
versioned relation. Until then, the omitted-dimension policy is singleton:
states with different or unknown values are not mergeable.

The relation is continuation-complete by induction, conditional on the
planned state-only transition being implemented exactly:

- **Base case:** with an empty suffix, equal states have equal phase, raw
  accumulator/enclosure state, canonical tuple, and tie key, so their final
  result and promotion decision are equal.
- **Inductive step:** for the same next legal suffix action, equal remaining
  action sets and equal card/progression/trigger/recipient ledgers produce the
  same next state. If accumulation has started, equal source positions and
  endpoint bits feed the same ordered binary64 operation or the same certified
  run transform. If it is ambiguous, both states follow ordered replay.
- **Conclusion:** every suffix sequence permitted by the same remaining-action
  set yields the same raw result, outward enclosure, micro-unit tuple, and
  canonical tie ordering.

This is a proof obligation for Phase 3, not a result already established by
the document. The exhaustive validation below is required before any state
key may be used for dominance.

## 6. Validation protocol

The Phase 3 validator must execute the following deterministic protocol against
the manifest in Section 7.

1. Verify all source hashes, the full-scope `scopeHash`, the chart hash, the
   fixed seed, the neutral Board signature, and the exact reduced Member and
   Leader lists before constructing a state.
2. Enumerate all 56 unordered legal Member sets from the pinned roster, all
   four fixed Leaders, and the one pinned chart. For each Member set, enumerate
   every legal ordered formation order and every prefix depth from 0 through 5.
   For each prefix, enumerate every legal ordered suffix that completes that
   formation. The 56 count is the reduced set count, not a license to test only
   the 224 sorted-order cases in the existing brute-force script.
3. Construct a serialized state from the prefix and resume it using only the
   serialized state plus the serialized suffix. Instrument the state-only
   dependency boundary and fail if the resume path calls any full-formation
   reference evaluator. Run the reference comparison in a separate adapter or
   process so that calling the reference does not make the resume path appear
   independent.
4. At every applicable resume checkpoint, compare the raw binary64 bits of
   every lower/central/upper accumulator endpoint, pass identity, and
   source-order cursor. For a completed suffix, compare final raw binary64
   endpoint bits, final outward enclosures, ordered lower/central/upper
   micro-units, and the complete canonical tie ordering.
5. Group states by canonical state key. For every pair of distinct histories
   whose keys collide, compare the complete result set for every common legal
   suffix, not just the winning candidate. Count these distinct-history merge
   pairs explicitly. With the prefix identity retained, zero pairs is a
   plausible outcome; it must be reported as **no merge rule exercised**, which
   validates resumption soundness only and never merge-rule soundness.
6. Run mutation-style negative checks in the same reduced corpus: remove one
   declared field at a time from a test key and require a detected divergence
   whenever that dimension is continuation-sensitive. A mutation that does not
   diverge in this scope is not proof that the field is removable; it is a
   scope limitation to record. For pinned context identity fields such as the
   chart signature, the mutation must also substitute or remove the chart key,
   expected chart hash, or singer/order signature and require rejection or a
   different canonical key. The validator does not need a second chart to
   search: charts are pinned inputs, not an optimization dimension, and this
   context-identity guard is the chart-signature negative check.
7. Record counts before comparisons become expensive: legal sets, ordered
   formations, Leaders, charts, prefix states, suffixes, resume-boundary
   comparisons, final comparisons, collision pairs, and mismatches. The stable
   evidence digest must canonicalize only deterministic inputs/results and must
   exclude timestamps, wall time, CPU time, RSS, and other runtime metadata.

The success branch is zero mismatches across all required comparisons and a
reproducible digest. The kill branch records the first concrete counterexample
with the two serialized states, suffix, boundary bits, final results, and
affected field. Under HC-10, the state or comparison rule is not adjusted to
make a counterexample pass. Either branch is an honest validation outcome;
only the success branch can make the X06 criterion eligible, and even that
does not prove a dominance prune.

## 7. Pinned reduced-suffix scope manifest

This is the single reduced-suffix scope selected for the Phase 3 validator. It
is pinned here in the design document before any implementation or artifact is
created. The existing script's 56 legal sets are re-pinned explicitly below;
the script's sorted-order 224-case run is evidence for the roster fixture only,
not the planned all-order suffix proof. The manifest deliberately contains one
chart because chart choice is a pinned input rather than a searched candidate.
The chart-signature dimension is still exercised by the validation protocol's
mutation guard: changing or removing its key/hash/singer-order signature must
be rejected or produce a distinct state key, while all continuation suffixes
are exhaustively exercised within the pinned `m0206:expert` context.

```json
{
  "manifestId": "yd-exact-optimizer-reduced-suffix-v1",
  "schemaVersion": 1,
  "status": "pinned",
  "sourceScope": {
    "path": "data/native/exact-optimizer-scope-v1.json",
    "fileSha256": "c8f5999a40e0c832686309cf781672636f7222389f0a5f97180eb6ab88265683",
    "scopeHash": "a53303691e95a289259b645b196ec3bea96fdc2609a6f527967d17fdc02e1871"
  },
  "roster": {
    "memberPool": [
      "card-00001-4-cmmn-0000-00",
      "card-00004-5-uniq-0005-00",
      "card-00005-5-uniq-0006-00",
      "card-00013-4-cmmn-0000-00",
      "card-00016-5-uniq-0014-00",
      "card-00018-5-uniq-0004-00",
      "card-00019-5-uniq-0016-00",
      "card-00039-5-uniq-0032-00"
    ],
    "leaderOutfitIds": [
      "card-00001-5-uniq-0000-00",
      "card-00013-5-uniq-0002-00",
      "card-00019-5-uniq-0016-00",
      "card-00039-5-uniq-0032-00"
    ],
    "legalMemberSetCount": 56,
    "legalMemberSetRule": "combinations(memberPool, 5), retaining unique talentId and at most five rarity-5 Members, with each set sorted by cardId",
    "orderedFormationPolicy": "all 120 permutations of each legal unordered set",
    "caseCountInExistingSortedFixture": 224
  },
  "chart": {
    "chartKeys": ["m0206:expert"],
    "expectedChartHash": "9b1d3743fceb9be12e4a2c4905904f7c",
    "weighting": "one chart, weight 1",
    "difficulty": "expert"
  },
  "investmentAndBloom": {
    "memberInvestmentLayer": "one-copy-maximum",
    "memberBloomStageByCardId": {
      "card-00001-4-cmmn-0000-00": 0,
      "card-00004-5-uniq-0005-00": 0,
      "card-00005-5-uniq-0006-00": 0,
      "card-00013-4-cmmn-0000-00": 0,
      "card-00016-5-uniq-0014-00": 0,
      "card-00018-5-uniq-0004-00": 0,
      "card-00019-5-uniq-0016-00": 0,
      "card-00039-5-uniq-0032-00": 0
    },
    "leaderInvestmentArgument": "none; Leader/Outfit is identified only by leaderCardId in the existing fixture",
    "duplicateOnlyBoosts": false
  },
  "board": {
    "stateId": "declared-neutral-board-v1",
    "mode": "declared-neutral",
    "evidenceGrade": "verified",
    "evidenceRef": "fixture:exact-reduced-bruteforce",
    "collectionBonus": "neutral-fixed",
    "connectEffects": "neutral-fixed"
  },
  "arithmetic": {
    "seed": 1497450319,
    "evaluator": "yd-native-utility-1.0.0",
    "arithmetic": "yd-canonical-micro-units-1.0.0",
    "memberOrderForTieKey": "sorted-card-ids",
    "accumulation": "ordered IEEE-754 binary64 with outward enclosures",
    "centralBulkGuard": "computed lower <= central <= upper per certified run; violation replays ordered"
  },
  "sourceHashes": {
    "reducedRosterScript": {
      "path": "scripts/run-exact-reduced-bruteforce.mjs",
      "sha256": "44084189cc88930566173e1f2c8d7302c523a385059b0fd943a671bd4ea31945"
    },
    "parityIr": {
      "path": "data/native/exact-optimizer-parity-ir-v1.json",
      "fileSha256": "9e856c8b9c981fe66e6b9401e14d18623cf95a331d213acb13c936ad597d2f7c",
      "irHash": "04d20828c5c2f11624db23a1068e07f47243d0b75db34842fe28d84c73d59074"
    },
    "publicRoster": {
      "path": "data/generated/holodori-public.json",
      "sha256": "6705cc7e05c9e63fdd5e12a9fb0b8273f09de910d2e1390fb70ae41daa7858e4"
    },
    "mechanics": {
      "path": "data/generated/holodori-mechanics.json",
      "sha256": "a181516762b8bbc2900082671c3eb3a339f9939cd7b66f71ec7dc6e22d0645c6"
    },
    "songs": {
      "path": "data/generated/holodori-songs.json",
      "sha256": "45a3d3c88c11fc365888abc3f11e80efd8bc1d8298aae879cab7a100cae87711"
    },
    "benchmark": {
      "path": "data/native/ranking-benchmark-v1.json",
      "sha256": "46ffad14b1376bf75d5b54fb7accd8e205c5d0b48fb7f94efb82b77c6d0aef6f"
    },
    "timelineProjection": {
      "path": "data/generated/holodori-ranking-corpus-timelines.json",
      "sha256": "8f08b78d4af766feb5afc4039cdccf32defb6a295ffcadb7a9763ec8473aab3b"
    },
    "timelineSourceManifest": {
      "path": "data/native/chart-timeline-source.json",
      "sha256": "b5bfc61f546a6f06ea26e82896d614c4feee849e27b6c5ecbca91f8cfa0e77f9"
    },
    "fullTimeline": {
      "path": "data/generated/holodori-chart-timelines.json",
      "sha256": "196c49c4825f4699316f88015ef554173e47af04072211fa46ef143b6aa11474"
    }
  },
  "certificateState": {
    "certificateEligible": false,
    "fullRunAuthorized": false,
    "dominancePilot": "not-in-scope"
  }
}
```

The source file hash for the full scope manifest is intentionally shown beside
its canonical `scopeHash`: the former addresses the current JSON bytes, while
the latter is the repository's canonical content hash excluding the hash field
itself. The reduced manifest above is not yet an evidence artifact and has no
validation digest. Phase 3 must make its generated artifact agree with this
block before any enumeration result is considered in scope.

## 8. Boundaries and non-claims

This design does not implement a TypeScript module, a validator, a dominance
frontier, B2 pruning, a timing experiment, a new evidence JSON file, or a
status migration. It does not claim that distinct prefixes will merge; in
fact, retaining prefix identity may produce zero distinct-history collisions.
It does not claim sufficiency outside the pinned reduced roster, single chart,
fixed investment/Bloom state, fixed Board, fixed seed, supported mechanics, or
the exact continuation dimensions enumerated in Section 6.

The next phase may earn X06 credit only after the state-only implementation and
the exhaustive success branch meet the plan's DoD-4 and DoD-5 gates. A
counterexample is a valid kill outcome and must remain visible under HC-9.
