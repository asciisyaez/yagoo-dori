# Exact optimizer specification v1

**Status:** v0.2 research/certification work; not a public global-optimum claim.
**Specification ID:** `yd-exact-optimizer-spec-1.0.0`
**Canonical scope manifest:** [`data/native/exact-optimizer-scope-v1.json`](../data/native/exact-optimizer-scope-v1.json)
**Canonical scope hash:** `a53303691e95a289259b645b196ec3bea96fdc2609a6f527967d17fdc02e1871`

This document freezes what a certificate would mean. The TypeScript native
evaluator is the reference implementation until a compiled kernel passes the
complete parity gate. The Rust project under `tools/exact-global-solver` is a
disposable prototype and is not a certificate merely because it compiles.

## 1. Complete input tuple

The scope hash covers every field below. A result is valid only when its request
serializes to the same canonical manifest; a full-roster result never proves a
different owned roster, Bloom state, Oshi constraint, guide, song, or investment
configuration.

| Input | Canonical v1 value |
| --- | --- |
| Roster source | HolodoriDB English commit `1907a1b9f85beb22e9d255686a26e0bd5db223e9` |
| Roster data | 113 current card IDs, explicit in the manifest; both Member and Leader/Outfit eligible |
| Mechanics | `data/generated/holodori-mechanics.json`, SHA-256 `a181516762b8bbc2900082671c3eb3a339f9939cd7b66f71ec7dc6e22d0645c6` |
| Song corpus | `data/generated/holodori-songs.json`, SHA-256 `45a3d3c88c11fc365888abc3f11e80efd8bc1d8298aae879cab7a100cae87711` |
| Aggregate benchmark | `launch-2026-07-31-matched-context-v1`, 30 Expert charts, equal weight 1/30 |
| Benchmark file | `data/native/ranking-benchmark-v1.json`, SHA-256 `46ffad14b1376bf75d5b54fb7accd8e205c5d0b48fb7f94efb82b77c6d0aef6f` |
| Exact timeline | Holodori chart corpus revision 51; parser commit `0d31cd7710fe5f68933211ad312813d984542f41`; local timeline hash is in the manifest |
| Eligible Members | All 113 manifest card IDs |
| Eligible Leaders/Outfits | All 113 manifest card IDs |
| Fixed Members | Empty |
| Oshi constraint | None |
| Five-star cap | At most five five-star Members |
| Investment | One-copy maximum; no duplicate-only boosts |
| Bloom | Bloom 0 for every eligible card, explicit per-card map in the manifest |
| Board/account | `declared-neutral-board-v1`; neutral fixed collection and Connect state |
| Seed | Decimal `1497450319` (`0x5941474f`) |
| Evaluator | `yd-native-utility-1.0.0` |
| Arithmetic | `yd-canonical-micro-units-1.0.0` |

The manifest also records the public-data, mechanics, song, benchmark, and
timeline file hashes. Regenerating it after any pinned input changes produces a
new scope hash rather than silently reusing this certificate.

## 2. Aggregate team objective (Claim A)

For each legal unordered five-Member team and eligible Leader/Outfit, evaluate
the existing native relative-utility interval on each of the 30 charts. Convert
the evaluator's six-decimal lower, central, and upper values to signed integer
micro-units using the native `Math.round(value * 1_000_000)` boundary. Average
each component across the equal-weight chart corpus at the same canonical
rounding boundary.

Candidates are compared lexicographically:

1. Highest equal-chart-average central relative utility.
2. Highest equal-chart-average lower relative utility.
3. Highest equal-chart-average upper relative utility.
4. Lexicographically smallest `leaderCardId|sortedMemberCardIds` key.

The complete score-comparator tie set (same central, lower, and upper
micro-units) must be recorded before applying rule 4. There is no arbitrary
floating-point epsilon. Branches may be pruned only when an outward-rounded
integer upper central bound is **strictly lower** than the incumbent central
micro-unit value; equality is expanded and exact-evaluated.

**Claim A wording:**

> Globally optimal unordered five-Member team and eligible Leader/Outfit within
> the declared scope under the pinned aggregate-central relative-utility model.

This is not an absolute Live Score, and it is not a joint team-and-formation
order proof.

## 3. Conditional formation-order objective (Claim B)

After Claim A identifies every aggregate-optimal score-comparator tie, evaluate
all 120 left-to-right placements for every tied team/Leader. Use the existing
`yd-formation-order-timed-corpus-1.0.0` timing-regret methodology and record all
120 values, the selected order, runner-up, maximum and mean regret, win share,
and timeline hashes.

**Claim B wording:**

> Among all 120 placements of the selected aggregate-optimal team, the reported
> order is selected under the pinned exact-timeline timing-regret methodology.

`formationOrderGloballyCertified` remains false. A future joint global
(team, Leader, order) certificate would require a new single scalar objective,
new specification, and new proof; it must not be retrofitted onto this
two-stage model.

## 4. Result and certificate boundaries

Every result/run record must expose:

- `resultClaim`, `certificateKind`, `scopeHash`, and objective ID;
- eligible team sets in scope, evaluated, pruned, and unsearched;
- optimality gap, evaluator/arithmetic methodology versions, and run-record ID;
- formation-order certification state and conditional-order record where present.

Candidate, timeout, FEASIBLE, best-known, and bounded outputs remain
`certificateEligible=false`. A SHA-256 content-addressed manifest is an
integrity address, not a cryptographic signature; no signed-certificate claim is
made without an actual signing identity and verification path.

## 5. First full-scope accounting target

The declared legal Member-team count is **126,445,821**. The certifying reducer
must account for every legal team as either an exact-evaluated leaf or a branch
pruned by a strictly lower outward-rounded bound, then evaluate all eligible
Leader classes exactly. A run that times out, has a parity mismatch, leaves an
unsearched set, or cannot be independently replayed remains a run report only.
