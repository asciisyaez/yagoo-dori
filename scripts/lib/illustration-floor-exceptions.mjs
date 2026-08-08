// Documented below-floor illustration exceptions (user-approved 2026-08-07).
// Each entry pins the EXACT dimensions of the best available original at
// intake time, so any silent source change still fails loudly. Remove an
// entry (and re-sync) as soon as a sanctioned source posts a compliant
// >= 2282x1284 original.
export const illustrationFloorExceptionByCardId = Object.freeze({
  "card-00015-5-uniq-0067-00": Object.freeze({
    exactWidth: 2098,
    exactHeight: 1179,
    reason:
      "Release-day intake (same 2026-08 summer banner): the AppMedia original upload is 2098x1179 and the declared Game8 fallback pages do not list the card yet.",
    upgradeWhen: "a sanctioned source posts a >=2282x1284 original",
    approvedAt: "2026-08-07",
  }),
  "card-00018-5-uniq-0068-00": Object.freeze({
    exactWidth: 2099,
    exactHeight: 1179,
    reason:
      "Release-day intake: the AppMedia original upload is 2099x1179 and the declared Game8 fallback pages do not list the card yet.",
    upgradeWhen: "a sanctioned source posts a >=2282x1284 original",
    approvedAt: "2026-08-07",
  }),
});
