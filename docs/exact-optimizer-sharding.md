# Full-scope exact-search sharding

The v0.2 certification work now includes a deterministic plan for the complete
declared Member roster:

```text
pnpm optimizer:shards:plan
pnpm optimizer:shards:plan:verify
```

The generated artifact is
`data/native/exact-optimizer-full-shard-plan-v1.json`. It is a **plan-only
artifact**, not a result or proof. It deliberately has
`certificateEligible: false` and every planned shard starts with all of its
team sets unsearched.

## Scope and ordering

The plan is addressed to scope hash
`a53303691e95a289259b645b196ec3bea96fdc2609a6f527967d17fdc02e1871` and
recomputes the declared unrestricted legal-team count of **126,445,821**. The
stable enumeration order is:

1. talent groups by ascending `talentId`;
2. cards in a talent group by ascending `cardId`;
3. choose-card branches before the skip branch;
4. one card per talent and at most five five-star Members.

Each shard owns one contiguous zero-based ordinal range over legal unordered
Member teams. The generated default target is one million team sets per shard;
the 126,445,821-team scope currently produces 864 deterministic ranges. A
shard also records the talent-prefix decisions that define its subtree, so a
future worker can resume from the same scope, range, and prefix rather than
guessing where an interrupted traversal stopped.

## Resume and claim boundary

Every shard has a resume token derived from its scope hash, shard ID, ordinal
range, and prefix. A worker may report `pending`, `running`, `complete`, or
`failed`, but a partial or timed-out shard remains unsearched and cannot be
reduced into a certificate. The eventual certifying worker must replace the
plan-only counts with exact leaves or strictly lower outward-rounded pruned
counts, then pass the existing independent shard verifier and TypeScript
replay gates.

`pnpm optimizer:shards:plan:verify` independently checks the source hashes,
recomputes the legal-team count through the TypeScript reference primitive,
validates contiguous non-overlapping ranges and prefix tokens, and confirms the
plan address. It never treats the plan as evidence that any utility was
evaluated.

## What remains open

The measured compiled throughput still makes the naive per-Team × Leader ×
Chart projection impractical. The next implementation is a parity-backed exact
aggregation benchmark that may reuse leader resolutions only when their pinned
structural class and chart-specific resolved application graph are identical.
If that factorization cannot be proven against the reference evaluator, it will
remain a benchmark rejection rather than entering the certification path.
