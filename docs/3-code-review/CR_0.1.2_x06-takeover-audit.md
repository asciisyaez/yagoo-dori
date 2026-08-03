# CR 0.1.2 — X06 Takeover Audit

Date: 2026-08-04 (audit executed 2026-08-03 → 2026-08-04)
Auditor: Claude (standalone takeover session; TRIP plan
`docs/1-plans/F_0.1.2_x06-continuation-complete-partial-state.plan.md`)
Scope: the complete uncommitted X06 working tree (diff from `c0267720` plus
all untracked X06 files), audited against its own recorded claims per the six
handover audit surfaces. Prior agent reports were not accepted without code
inspection.

## Verification baseline (DoD-2)

All focused checks passed on the inherited tree before any audit fix:

- `pnpm --filter @yagoo-dori/core typecheck` — clean
- Affected tests (`exact-optimizer-bulk-accumulation`, `exact-optimizer-kernel`,
  `native-utility-trace`) — 11/11 pass
- `pnpm optimizer:parity:bulk:rehash` — passed; stable evidence digest
  `320da206…` matches the handover
- `pnpm optimizer:proof:reduced` — counts reconciled; report hash `34501568…`
- `pnpm optimizer:shards:determinism` — serial/parallel/resumed byte-identical
- `pnpm optimizer:shards:verify:reduced` — 56/56 legal teams, 0 failures
- No new tracked-JSON churn was produced by these runs

## Findings

Severity per docs/TRIP-checklist.md. Disposition key: FIXED (in audit phase),
ESCALATED (user decision required before evaluator edits), RECORDED (no code
change this iteration).

### F-1 (Major, FIXED) — Evidence digest not reproducible from artifact bytes

`canonicalize` in the four X06 evidence scripts serialized `undefined`-valued
object keys into the digest input while `JSON.stringify` drops them from the
written file. Concretely, `generate-exact-optimizer-bulk-performance.mjs`
mapped the 1-worker replay entry to `{ …, speedupVersusSerialC: undefined }`,
so `exact-optimizer-bulk-performance-v1.json`'s recorded
`deterministicReportHash` (`596327f1…`) could not be recomputed from the file
(true reproducible value: `86950326…` — proven by reconstruction). The defect
propagated by reference into cost-model-v3 and dominance-feasibility.

Fix: `canonicalize` now skips `undefined` object values and serializes
`undefined` array items as `null` (matching file bytes exactly) in
`run-exact-optimizer-bulk-parity.mjs`, `run-exact-optimizer-bulk-rebaseline.mjs`,
`generate-exact-optimizer-bulk-performance.mjs`, and
`generate-exact-optimizer-dominance-feasibility.mjs`. The perf → cost →
dominance chain was regenerated: perf `86950326…`, cost `01fcf617…`,
dominance `66452293…`; all cross-references agree; rerun reproduces identical
hashes; all `certificateEligible`/`fullRunAuthorized`/`attempted` flags remain
`false`. The bulk-parity stable digest `320da206…` was verified unaffected
(its digest input contains no `undefined`-valued keys). No evaluator semantics
were touched; no parity re-execution obligated. (Decision Log D-4.)

### F-2 (Critical, ESCALATED) — Central-only B2 clamp identity asserted, not proven

`native-utility.ts`: the central-only path
(`centralBulkPrecondition` ~:1319, `aggregateCompressedActiveCentral` ~:1378,
consumed by `evaluateNativeCentralUtilityWithCompiledTeam` and kernel B2)
certifies `round(unclamped centralAvg)` on the doc-comment claim (~:1312)
that `interval()` can never clamp the central lane. That claim is unproven:
the three lanes are computed by structurally different fl expressions
(lower = max-product, central = inclusion–exclusion `expectedMaximumFive`,
upper = sum-product), and nothing establishes computed
`lower_i ≤ central_i ≤ upper_i` per note. On a near-tie, fl noise can push the
computed central below the computed lower; the reference clamps, B2 does not
model the clamp. If clamped and unclamped averages straddle a 0.5e-6 canonical
boundary, B2 would emit a certified central different from the reference —
an unsound prune certificate.

Mitigating evidence (also verified): the single-member degenerate case is
provably safe; the auditor's brute searches over permil/check-count/value
families found zero computed violations; the 100,000-case real corpus shows
zero `certifiedCentralVsFull` mismatches; a real divergence requires both a
lane inversion and a boundary straddle. The full B3 interval path is immune
(it models the clamp with enclosures and is additionally pinned by a runtime
equality throw). This is a proof-obligation gap in a certificate path, not an
observed wrong value — but by the repository's certify-or-replay standard it
is a defect.

Candidate fixes (user decision; both obligate full parity re-execution per
TRIP-config integration rules):
(a) add a per-note computed `lower ≤ central ≤ upper` guard in the central
path that falls back to ordered replay on violation (minimal, preserves the
certify-or-replay contract and most of B2's speed), or
(b) accumulate all three lanes in the central path and certify the clamp with
enclosures exactly like the interval path (heavier; erodes B2's purpose).

### F-3 (Major → mitigated, FIXED) — `--rehash-existing` re-blessed nearly arbitrary content

`run-exact-optimizer-bulk-parity.mjs` validated only two case-count fields
before minting the authoritative stable digest for whatever artifact was on
disk, and hard-codes a duplicate-run-equivalence qualification it does not
verify. Mitigation already present: the digest covers `passed` and all
counters, and the downstream perf generator independently re-validates them.
Fix: rehash now refuses artifacts unless `passed === true` at all three
levels, all six comparison-mismatch counters are zero, synthetic
falseCertificates/containmentFailures/expectedFallbackFailures are zero, and
both corpus digests exist.

### F-4 (Minor, FIXED) — X05 independent review was self-attested

`tickets/X05-scope-safe-integration.md` replaced its "unchecked until
independent review" gate with the assertion that checkpoint `c0267720`
"records the independently reviewed and accepted X05 evidence" — no reviewer
identity or review artifact exists in the repository, and the handover itself
states the final independent-context review never occurred. The 10 points X05
contributes to the 65% figure rested on that self-attestation. Fix: wording
corrected to state the evidence was accepted by the implementing session and
that the fresh independent-review requirement carries forward to the X06
completion gate (which this plan's DoD-8 enforces).

### F-5 (Minor, RECORDED) — Rebaseline "deterministicReportHash" embeds volatile data

`run-exact-optimizer-bulk-rebaseline.mjs` hashes the full report including
per-repeat wall/CPU/RSS values (only `generatedAt` is masked), so the name
overpromises: it is a content hash that will not survive a semantically
identical rerun. The script's internal `repeatMetricsDigests` do filter
timing correctly. Renaming cascades through cost-model references; deferred.
Determinism claims must cite the parity artifact's whitelist-built evidence
digest, never this hash.

### F-6 (Minor, RECORDED) — Misleading fallback reason in proof helpers

`native-utility.ts` proof helpers report `interval-width-overflow` for null
results actually caused by −0 or non-finite intermediates (~:1719, :1724,
:1736, :1795-1800). Conservative (always falls back) but misattributes cause
in telemetry. Fixing alters fallback-reason histograms inside evidence
digests, so it is bundled with the F-2 decision (both obligate parity
re-execution); if F-2 is fixed, correct these codes in the same change.

### F-7 (Suggestion, RECORDED) — Headroom comment proves less than the code needs

`exact-optimizer-bulk-accumulation.ts:376-379`: the factor-16 headroom
comment's absolute-error induction does not close for multiplicities near
2^53; the bound is nonetheless valid via the relative-error growth argument
((1+2⁻⁵³)ⁿ ≤ e < 8). The code is sound; the comment should cite the
multiplicative argument. Bundle with the next edit to that file.

### F-8 (Suggestion, RECORDED) — Unit-level fallback-reason coverage is partial

`exact-optimizer-bulk-accumulation.test.ts` exercises 5 of 8 stable fallback
reasons; `invalid-multiplicity`, `interval-width-overflow`, and
`unsupported-operation-path` are covered only by the synthetic corpus.
Candidate additions for the Phase 3 test batch.

### F-9 (Note, RECORDED) — `stateRuns` telemetry semantics drifted

The compressed path's `baseStateRuns`/`specialSupportStateRuns`/
`specialStateRuns` now report input-keyed run counts (identical across
passes, ≥ the old output-state-merged counts). Values are unaffected;
consumers of recorded baselines should not compare these counters across the
boundary.

## Audit surfaces — verdicts

1. **Outward rounding**: SOUND. Every propagation step uses genuinely outward
   primitives (nextDown/nextUp around correctly rounded ops, exact min/max,
   dyadic-bounded repeated-addition transform), or bare arithmetic only where
   a single-op bit-replay on singleton reference operands is exact.
2. **Canonical-bucket certification**: SOUND. Both endpoints canonicalize
   through the exact reference `Math.round(v·1e6)`; monotonicity closes the
   tie-boundary case; straddles fall back.
3. **B2 strict-loss-only**: STRUCTURALLY SOUND at the kernel (central-only
   type cannot carry lower/upper; equality promotion tested) — but see F-2
   for the certification gap beneath it.
4. **B3 promotion**: SOUND. Equal/fallback/finalist states materialize the
   full tuple; the interval path is pinned by a runtime equality throw.
5. **Stable evidence hashing**: SOUND AFTER F-1/F-3 FIXES; parity digest
   whitelist verified bit-for-bit reproducible.
6. **Status migration**: CLEAN (all old criteria preserved verbatim; weights
   sum to 100; 65.0% recomputed by hand; X04 untouched except its dependency
   pointer) — with F-4's honesty correction applied.

## Disposition

The inherited X06 implementation is of genuinely high quality; the audit
confirms its central claims and evidence. Two findings required action beyond
documentation: F-1 (fixed, evidence chain regenerated and now externally
verifiable) and F-2 (escalated — the sole place in the ~1,300 inherited lines
where an unsound certificate could in principle escape into pruning). X06
criterion 2 ("B2 exposes only a certified central value…") should be read as
conditional on the F-2 resolution.
