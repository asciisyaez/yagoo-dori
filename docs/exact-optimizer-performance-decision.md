# Exact optimizer performance decision

**Decision:** do not launch the full 864-shard plan.

The guarded bulk accumulator is retained only for individually certified
complete inputs. It preserves left-to-right RN-even binary64 arithmetic, and
an ambiguous canonical enclosure replays the smallest affected component in
source order. B2 exposes a central value only for a certified strict loss;
equality, finalists, and fallbacks promote to B3. Neither the accelerator nor
this document authorizes a full run or a global certificate.

## Stable evidence and normalized comparison

The complete 1,000,000-case boundary corpus and 100,000-case real corpus have
zero containment failures, false certificates, and comparison mismatches. The
parity artifact now uses a stable evidence digest that excludes generated time
and runtime telemetry while retaining pinned scope/sample hashes, deterministic
corpus digests, counts, fallback categories, mismatch counts, and claim flags.

The primary full run's old volatile report hash was
`be71471f245bf33e8aa6394441fba264507b3cb863b3c422303e9ef6fda971c5`.
Its accepted timings were 52,363.324 ms ordered state-run, 36,345.890 ms full
B3, and 24,154.840 ms B2. The later interrupted duplicate's old volatile hash
was `ae560e0ad55c681cf100c8297e5288e6914a3d57e4cd5f477c7ea69d8d6a526c`.
It has the same stable evidence but different runtime values, which is why old
report hashes are no longer used as parity evidence.

The current normalized architecture rebaseline runs the exact same 8 teams ×
4 Leaders × 30 charts = 960 declared states for the independent ordered B3
reference and A/B/C. It performs one warm-up and five serial measured repeats
per path. The ordered reference and A/B/C have the same winner/tie digest.
Current wall-clock p50 / p95 / worst values are 467.959 / 506.120 / 506.120 ms
(ordered), 304.348 / 313.649 / 313.649 ms (A), 419.376 / 439.530 / 439.530 ms
(B), and 1,239.226 / 1,258.107 / 1,258.107 ms (C); CPU and RSS snapshots are
in the artifact. One-worker C is repeated timing. The 2/4/8/16/32-worker runs
are single-run deterministic-parity replays only, not throughput or p95 scale
measurements, and receive no projection credit.

The coverage targets all miss: full B3 certifies 99,287/100,000 (99.287%) and
B2 certifies 99,605/100,000 (99.605%), below 99.9%. The primary B2 experiment
is 2.168x versus ordered state-run, below 15x, and normalized flat A is about
1.538x versus ordered B3, below the 8x end-to-end target.

## Cost model and no-go gate

The declared scope is 126,445,821 legal Member teams × 113 Leader/Outfits ×
30 charts = 428,651,333,190 Leader-team-chart states. The current complete
bulk corpus has aggregate elapsed totals rather than per-state p95 samples,
and the compact worker replays are deliberately not projected. Therefore
`exact-optimizer-cost-model-v3.json` conservatively retains the
scope-identical stratified-p95 no-pruning bound without granting bulk,
dominance, pruning, or newer-worker speedup credit.

That retained bound is 36,624.157 raw core-hours and 45,780.196 core-hours with
25% contingency. Its p95 wall estimates with contingency are 45,780.196 hours
at one worker, 10,540.989 at eight, 8,763.144 at sixteen, and 9,845.993 at
thirty-two. All are far beyond the <=800 raw-core-hour and <=72-hour p95 gate.
Unmeasured current-bulk per-state p95, current worker throughput p95, and
full-113-Leader B0 cost are explicitly unavailable rather than fabricated.

`fullRunAuthorized=false` and `certificateEligible=false` remain mandatory.

## Phase-7 dominance feasibility

The required dominance feasibility artifact is a formal pre-pilot kill, not a
prose-only conditional decision. It records `attempted:false`, zero states,
zero dominance prunes, zero full-scope projection credit, and no frontier
metrics. A partial-team frontier is not safe until a continuation-complete
fixed-Leader state is proven to preserve formation/progression/trigger suffixes,
Leader recipient resolution, the source-order binary64 enclosure, and B3
equality/tie promotion. A reopening requires that proof and exhaustive
reduced-roster suffix validation before any frontier is timed.

Reproduce the compact evidence with:

```text
pnpm optimizer:parity:bulk:rehash
pnpm optimizer:architecture:rebaseline
pnpm optimizer:bulk:performance
pnpm optimizer:dominance:feasibility
```
