import { describe, expect, it } from "vitest";

import { isCardRecentlyAdded, trackingBaseline } from "./card-freshness";

describe("card freshness", () => {
  it("treats the backfilled baseline wave as never new", () => {
    // Launch condition: every card carries the tracking-start stamp.
    const baseline = trackingBaseline(["2026-08-08", "2026-08-08"]);
    expect(baseline).toBe("2026-08-08");
    expect(isCardRecentlyAdded("2026-08-08", "2026-08-08", baseline)).toBe(false);
  });

  it("marks only post-baseline cards within 30 snapshot-relative days", () => {
    const dates = ["2026-08-08", "2026-08-08", "2026-08-20", "2026-09-30"];
    const baseline = trackingBaseline(dates);
    expect(baseline).toBe("2026-08-08");
    // A patch card seen 12 days after baseline, snapshot 5 days later: new.
    expect(isCardRecentlyAdded("2026-08-20", "2026-08-25", baseline)).toBe(true);
    // The same card 31+ days after its first sighting: no longer new.
    expect(isCardRecentlyAdded("2026-08-20", "2026-09-25", baseline)).toBe(false);
    // Post-baseline but seen "after" the snapshot (clock skew): never new.
    expect(isCardRecentlyAdded("2026-09-30", "2026-09-25", baseline)).toBe(false);
  });

  it("fails closed on malformed dates and empty datasets", () => {
    expect(trackingBaseline([])).toBeNull();
    expect(trackingBaseline(["not-a-date"])).toBeNull();
    expect(isCardRecentlyAdded("2026-08-20", "2026-08-25", null)).toBe(false);
    expect(isCardRecentlyAdded("2026-02-30", "2026-08-25", "2026-01-01")).toBe(false);
    expect(isCardRecentlyAdded("2026-08-20", "bad", "2026-01-01")).toBe(false);
  });
});
