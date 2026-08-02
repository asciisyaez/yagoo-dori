# Exact optimizer factorization and trace rules

**Status:** research/proof architecture only. Every output remains
`certificateEligible: false` until the declared full scope is evaluated and
independently replayed.

The TypeScript native utility evaluator remains the semantic authority. The
factorization below removes repeated setup work only after preserving its exact
observable arithmetic order; it does not replace the model with an algebraic
equivalent.

## Selected boundary

The selected execution shape is **team-intrinsic first, fixed Leader second**.
For a legal unordered five-Member team, compile and cache only facts that do
not depend on a Leader/Outfit:

| Reused for every fixed Leader | Recomputed for every Leader/Outfit and chart |
| --- | --- |
| exact Member progression and Active timing | Leader applications and resolved recipients |
| per-chart Active opportunity-check counts | Leader-derived persistent support and parameter effects |
| Member card order/key validation | Active score-up selections affected by the legal formation and song |
| immutable member array | final lower/central/upper utility and canonical comparison tuple |

`compileNativeUtilityTeamIntrinsic` carries only the first column. The caller
must still pass the same Member key to
`evaluateNativeRelativeUtilityWithCompiledTeam`; a mismatch throws before any
evaluation. This is intentionally conservative: a Leader’s attribute, talent,
applications, or target resolution is never stored in the team cache.

The current catalog’s proof key treats distinct Leader talents as distinct
classes. In the present pinned roster this yields 113 singleton classes, so the
architecture claims **no cross-Outfit utility reuse**. The team cache is the
only normal-path factorization; any future non-singleton Leader class needs a
new whole-output proof before it can reduce B3 evaluations.

## Trace-preserving Active compression

The aggregate evaluator first builds a complete Active state for every note:

- exact selected score-up interval for each Member at that combo;
- exact number of Active checks at the note;
- lower/central activation probabilities;
- lower/central/upper supported values for all five Members.

Adjacent equal five-Member states form a state run. The kernel calculates the
five-way expected maximum once per run, then replays its contribution through
the original note loop one addition at a time. It does not replace repeated
addition with multiplication, batch-reduce notes, or parallel-reduce floating
point values. The operation order remains source resolution, per-note expected
maximum, ordered accumulation, per-chart rounding, then final aggregate
rounding.

Compression is admitted only when all current conditions hold:

1. every Active trigger is in the explicitly supported static set and has at
   most 255 selection breakpoints;
2. the compiled Member timing exactly matches the resolved skill timing;
3. Special score support is constant for every note; and
4. activation-rate support spans the complete chart at one constant rate.

Otherwise the evaluator uses the independent uncompressed note-state path and
records `uncompressed-fallback` plus a reason. The public result contract stays
unchanged; `evaluateNativeRelativeUtilityWithTrace` exposes the execution
evidence, and `evaluateNativeRelativeUtilityUncompressed` is retained solely
as the exact cross-check authority.

`data/native/exact-optimizer-compiled-parity-v1.json` is the current
trace-preserving gate: 100,000 deterministic complete inputs run through both
the compiled and forced-uncompressed paths, with lower/central/upper canonical
micro-units compared for every input. The current artifact records zero endpoint
mismatches, zero trace fallbacks, and zero direct-reference mismatches.
`data/native/exact-optimizer-coverage-v1.json` consumes that full evidence;
its three reduced cases and two independent child-process partitions are
supplemental regressions, not the authorization source. Candidate evaluations
may run in parallel; their individual arithmetic traces may not.

## Safe proof cascade

The global path explicitly separates these stages:

| Stage | Meaning | Safety rule |
| --- | --- | --- |
| B0 | outward-rounded root maximum | maximum of complete B1 results only |
| B1 | root bound for one fixed Leader | no parameter/support component may come from another Leader |
| B2 | bound for a partial Member selection and fixed Leader | strict upper-central comparison only |
| B3 | exact completed Member/Leader pair evaluation | every actual Outfit ID is evaluated, not merely a bound representative |

Equality at the canonical central upper bound survives to B3. Certificate
accounting reconciles both class/team and actual Outfit/team pair counts, which
prevents a structural cache from silently altering the comparator tie space.
`data/native/exact-optimizer-leader-root-bounds-v1.json` records one
singleton-safe record for each current Leader class: representative ID,
multiplicity, outward root bound, bounded-incumbent gap, strict-root-prune
result, and methodology hash over the full 113-Member/30-chart scope. The
current full ledger has 113 singleton classes and zero root prunes; the compact
B0/B1/B2/B3 fixture remains a separate regression check.

## Reproduction

```text
pnpm optimizer:parity:compiled
pnpm optimizer:bounds:roots
pnpm optimizer:coverage
pnpm optimizer:proof:reduced
pnpm optimizer:performance:pilot
```

The reduced proof exercises 36 legal Member sets, four actual Leaders, and two
charts through the compiled trace kernel plus independent uncompressed
cross-checks. It is a regression proof, not a substitute for the full trace or
full root-bound evidence.

The Rust `certification` Cargo profile is profiling-only and deliberately has
no fast-math or reassociation flags. Its binary remains a disposable research
prototype and is not part of this certifying execution path.
