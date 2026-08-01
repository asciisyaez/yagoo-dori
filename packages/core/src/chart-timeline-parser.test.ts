import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import sourceManifest from "../../../data/native/chart-timeline-source.json";
import { countTimelineEvents, parseHolodoriSus } from "./chart-timeline-parser";

const fixturePath = fileURLToPath(new URL("./fixtures/chart-m0049-expert.sus", import.meta.url));
const fixture = readFileSync(fixturePath, "utf8");

describe("holodori exact chart timeline parser", () => {
  it("pins the representative public SUS fixture by URL, API revision, and hash", () => {
    expect(sourceManifest.apiRevision).toBe(51);
    expect(sourceManifest.parserReference).toMatchObject({
      commit: "0d31cd7710fe5f68933211ad312813d984542f41",
      license: "MIT",
    });
    expect(createHash("sha256").update(fixture).digest("hex")).toBe(
      sourceManifest.fixture.susSha256,
    );
  });

  it("reconstructs every SPARKS Expert combo event and its five exact Special markers", () => {
    const parsed = parseHolodoriSus(fixture);

    expect(parsed.musicId).toBe("m0049");
    expect(parsed.declaredFullCombo).toBe(720);
    expect(parsed.events).toHaveLength(720);
    expect(countTimelineEvents(parsed.events)).toEqual(parsed.declaredCounts);
    expect(parsed.declaredCounts).toEqual({
      normal: 387,
      flick: 25,
      "long-start": 111,
      "long-end": 93,
      "long-flick-end": 18,
      "long-continuation": 59,
      "long-relay": 27,
      damage: 0,
    });
    expect(parsed.specialMarkerMicroseconds).toEqual([
      9_090_909,
      27_272_727,
      43_636_364,
      60_000_000,
      85_454_545,
    ]);
    expect(parsed.feverMarkerMicroseconds).toEqual({
      chargeStart: 40_000_000,
      chargeEnd: 55_000_000,
      feverStart: 60_000_000,
      feverEnd: 80_454_545,
    });
    expect(
      parsed.events.every(
        (event, index) => index === 0 || event.atMicroseconds >= parsed.events[index - 1]!.atMicroseconds,
      ),
    ).toBe(true);
  });
});
