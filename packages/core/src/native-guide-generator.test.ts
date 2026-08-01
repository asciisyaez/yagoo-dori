import { describe, expect, it } from "vitest";

import {
  DEFAULT_GUIDE_ANCHOR_CARD_ID,
  generateNativeGuideData,
  guideLeaderOutfitCardIdsForSong,
  selectGuideRatingSongs,
} from "./native-guide-generator";
import { publicCardById } from "./public-data";

describe("native guide request resolution", () => {
  it("rejects an anchor that is not one exact 5-star Member card", () => {
    expect(() =>
      generateNativeGuideData("2026-07-31T16:00:00.000Z", {
        anchorCardId: "card-00013-4-cmmn-0000-00",
      }),
    ).toThrow(/exact 5-star/i);
  });

  it("rejects an unknown fixed Leader Outfit before searching", () => {
    expect(() =>
      generateNativeGuideData("2026-07-31T16:00:00.000Z", {
        fixedLeaderOutfitCardId: "missing-outfit",
      }),
    ).toThrow(/unknown fixed Leader/i);
  });

  it("selects only rating-eligible songs that list the guide singer", () => {
    const selection = selectGuideRatingSongs(DEFAULT_GUIDE_ANCHOR_CARD_ID);

    expect(selection.singerTalentId).toBe("chr-00013");
    expect(selection.songs.map((song) => song.id)).toEqual([
      "m0141",
      "m0189",
      "m0164",
      "m0074",
      "m0163",
      "m0303",
    ]);
    expect(
      selection.songs.every(
        (song) =>
          song.scoreRatingEligible && song.singerTalentIds.includes(selection.singerTalentId),
      ),
    ).toBe(true);
  });

  it("constrains every song search to Leader Outfits for its declared singer", () => {
    const selection = selectGuideRatingSongs(
      DEFAULT_GUIDE_ANCHOR_CARD_ID,
      "card-00039-5-uniq-0032-00",
    );
    expect(selection.singerTalentId).toBe("chr-00039");
    expect(selection.songs.map((song) => song.id)).toEqual([
      "m0155",
      "m0105",
      "m0046",
      "m0164",
    ]);

    for (const song of selection.songs) {
      const leaderIds = guideLeaderOutfitCardIdsForSong(song.id, selection.singerTalentId);
      expect(leaderIds.length).toBeGreaterThan(0);
      expect(
        leaderIds.every(
          (cardId) => publicCardById.get(cardId)?.talentId === selection.singerTalentId,
        ),
      ).toBe(true);
    }
  });
});
