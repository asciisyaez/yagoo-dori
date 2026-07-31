# Review manifest

Pass a JSON object with `patchId`, `methodologyVersion`, and a nonempty `changes` array.

Each change requires:

- `dataset`, `recordId`, and dotted `field`;
- `proposedValue`;
- `sourceIds`, `upstreamVersion`, ISO `retrievedAt`, and `patchId`;
- `verificationState` (`verified` or `corroborated`) and confidence from 0 to 1;
- `reason`: `direct-change`, `new-synergy`, `chart-meta`, `new-evidence`, or `methodology-correction`.

For a ranking change, also provide `scoreDelta` and `attributions` with `{ "reason", "delta" }` entries. Their sum must exactly equal `scoreDelta`.

The review command is read-only. It does not apply the candidate.
