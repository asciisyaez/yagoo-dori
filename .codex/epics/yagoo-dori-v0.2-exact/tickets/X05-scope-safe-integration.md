---
id: X05
title: Certifiable performance architecture
status: done
depends_on: [X01, X02, X03]
parallelizable: false
parent_epic: yagoo-dori-v0.2-exact
---

# X05: Certifiable performance architecture

## Acceptance criteria

- [x] A Member-intrinsic compiled kernel proves byte-identical canonical
  lower/central/upper output against the independent uncompressed evaluator,
  while unsupported timing states explicitly fall back.
- [x] B0/B1/B2/B3 bounds condition every optimistic result on one whole
  Leader/Outfit and reconcile actual Outfit/team pairs at B3.
- [x] Executable catalog coverage, reduced proof, serial replay, and independent
  candidate-partition replay have current, content-addressed evidence.
- [x] The measured full-scope cost model either clears the declared budget or
  records a no-go decision without launching the full shard plan.

## Current implementation evidence

`pnpm optimizer:parity:compiled` now records 100,000 deterministic complete
compiled-versus-forced-uncompressed lower/central/upper traces with zero
endpoint mismatches, zero fallback, and zero direct-reference mismatches.
`pnpm optimizer:bounds:roots` records all 113 singleton-safe Leader classes
over the full 113-Member/30-chart scope, including representative,
multiplicity, outward bound, bounded-incumbent gap, strict-root-prune result,
and methodology hash. `pnpm optimizer:coverage` derives authorization from
those two full artifacts; its reduced B0/B1/B2/B3 fixture remains separate.

Checkpoint commit `c0267720` records the X05 evidence as accepted by the
implementing session; no separate independent-context reviewer is recorded in
the repository, and the fresh independent review requirement carries forward
to the X06 completion gate. `pnpm optimizer:performance:pilot` measures matched A/B/C outputs
on 32 deterministic stratified shards and records a no-go full-run decision.
It also records real 8/16/32 candidate-worker replays, p50/p95 throughput/RSS,
stage accounting, and a p95 no-pruning cost model. The ticket is checkpointed
done; this evidence does not authorize the full run.
