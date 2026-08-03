# Exact optimizer bulk accumulation

**Status:** proof-carrying research acceleration. It remains
`certificateEligible: false` and does not authorize the full shard plan.

This document defines the narrow bulk path used by the exact-optimizer
research evaluator. It accelerates repeated equal Active-state contributions
without changing the reference recurrence or treating `n * x` as an answer.

## Reference recurrence

For every source-order state run, the semantic reference is exactly:

```text
s(0) = incoming
s(i + 1) = RN-even-binary64(s(i) + contribution), for i = 0 .. multiplicity - 1
```

`incoming` is the enclosure produced by the preceding run. A proof may not
restart at zero, reassociate additions, batch-reduce notes, or substitute
`incoming + multiplicity * contribution` for the returned value. The
independent fallback, `replayOrderedRepeatedBinary64Addition`, retains that
left-to-right recurrence.

## Certified run transform

`transformRepeatedBinary64Addition` first verifies that the state-run
scheduler gives the same contribution at both ends of a multi-note run. It
then represents normal binary64 inputs as exact signed dyadics using `BigInt`.
The exact dyadic upper sum gives a conservative magnitude for the sequential
addition error bound; the returned result is an outward binary64 enclosure of
the recurrence, not the exact real sum.

The transform is intentionally restricted to the present non-negative Active
path. It rejects or falls back for:

- `canonical-boundary-overlap`
- `unsupported-nonfinite-value`
- `subnormal-assumption-not-proven`
- `interval-width-overflow`
- `contribution-mismatch`
- `unsupported-operation-path`
- `signed-zero-sensitive`
- `invalid-multiplicity`

These are stable telemetry values. A fallback is a correctness result: the
affected Active component is replayed in source order, rather than widened
until it happens to fit a desired canonical bucket.

## Canonical boundaries and later operations

An enclosure is accepted only when the repository's existing
`Math.round(value * 1_000_000)` canonicalizer has one image over the entire
interval. JavaScript's half-tie rule is treated separately from binary64
round-to-nearest-even: JavaScript rounds a negative half toward positive
infinity.

The proof does not stop after an Active average. Once the three Active passes
are certified, `proveNativeBulkPostActiveCanonical` carries enclosures through
the native source order for:

1. Special support and activation-rate subtraction/max branches;
2. every `interval()` clamp and its six-decimal round;
3. base-parameter multiplication and division by 1,000;
4. parameter-effect addition; and
5. the final utility `interval()` boundary.

Any ambiguous later boundary replays the three Active components rather than
claiming a final certificate from an Active-only result. Focused regression
coverage includes a case where an apparently singleton Active micro-unit lands
in a materially different final utility bucket after scaling and Special
arithmetic.

## B2 and B3 contract

The B2 entrypoint, `evaluateExactOptimizerTeamLeaderCentral`, computes only a
central candidate value and returns one of:

- `bulk-certified-reference-equivalent`, with a central micro-unit value; or
- `ordered-replay-required`, with no central value and a stable reason.

B2 is permitted to prune only when its certified central value is *strictly*
below the incumbent central micro-unit. Equality, finalists, and all fallbacks
must promote to B3. B3 materializes the full lower/central/upper tuple through
the full evaluator, which either carries a final bulk proof or uses the
ordered component replay. B2 never exposes a tuple, so it cannot silently
alter lower/upper or tie-key comparison.

The compact architecture rebaseline keeps this separation explicit:

- A uses B2 for all 960 fixed workload chart states and B3 only for required
  promotions;
- B adds a fixed-Leader B1 bound before the same B2/B3 policy; and
- C adds whole-Leader B0 and B1 bounds before that same policy.

The independent ordered-state B3 evaluator remains available for parity and
research checks.

## Current evidence and decision

`pnpm optimizer:parity:bulk` records one million deterministic accumulator
boundary cases plus the pinned 100,000-case real corpus. The current artifact
has zero containment failures, zero false certificates, and zero Rust,
TypeScript-reference, ordered-state, full-bulk, or certified-B2 mismatches.
Its authoritative `deterministicEvidenceDigest` excludes wall time, CPU time,
RSS, and generation time; it contains pinned inputs, corpus digests, case and
fallback counts, mismatch counts, and the claim flags. Runtime observations
remain separately recorded and never define parity.

Two complete runs corroborate that distinction. The primary run's legacy
volatile report hash is
`be71471f245bf33e8aa6394441fba264507b3cb863b3c422303e9ef6fda971c5`;
an interrupted duplicate run's legacy volatile report hash is
`ae560e0ad55c681cf100c8297e5288e6914a3d57e4cd5f477c7ea69d8d6a526c`.
They have identical synthetic and real corpus digests, category/fallback
counts, and zero mismatch counts; only runtime metadata differs. The primary
run observed 52,363.324 ms ordered, 36,345.890 ms full B3, and 24,154.840 ms
B2. The duplicate records its own timing separately and is corroboration, not
a replacement speed claim.

Its fast-path coverage does **not** meet the declared 99.9% target:

| Path | Certified | Ordered replay required | Coverage |
| --- | ---: | ---: | ---: |
| Full B3 | 99,287 | 713 | 99.287% |
| Central B2 | 99,605 | 395 | 99.605% |

The measured complete-corpus timings are 52,363.324 ms for ordered state-run
evaluation, 36,345.890 ms for full bulk B3, and 24,154.840 ms for B2. B2 is
about 2.168x faster than the ordered state-run path on this corpus, but that
does not override the coverage miss or its fallback policy.

`data/native/exact-optimizer-bulk-performance-v1.json` records the conditional
dominance decision. The fast path is usable only per certified input; it is
not selected as a universal replacement, and no full run is authorized. The
99.9% coverage target, 15x B2 experiment target, and 8x end-to-end experiment
target were all missed.

## Reproduction

```text
pnpm optimizer:parity:bulk
pnpm optimizer:parity:bulk:rehash
pnpm optimizer:architecture:rebaseline
pnpm optimizer:bulk:performance
pnpm optimizer:dominance:feasibility
```

The rehash command migrates an already-complete artifact without re-executing
its corpus. The last two commands write the compact performance/cost record
and the phase-7 feasibility disposition. The cost model retains the prior
scope-identical stratified-p95 no-pruning bound with 25% contingency, grants
zero bulk/dominance/new-worker projection credit, and keeps
`fullRunAuthorized=false`.
