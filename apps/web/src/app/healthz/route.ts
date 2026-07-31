import { publicData } from "@yagoo-dori/core";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    status: "ok",
    service: "yagoo-dori-web",
    dataState: "pinned-public-snapshot",
    retrievedAt: publicData.retrievedAt,
    counts: {
      talents: publicData.counts.talents,
      memberCards: publicData.counts.total,
      fourStarCards: publicData.counts.fourStar,
      fiveStarCards: publicData.counts.fiveStar,
      leaderOutfits: publicData.cards.length,
      localCardIcons: publicData.counts.art,
      localCardIllustrations: publicData.counts.art,
    },
    sources: {
      englishCommit: publicData.sourceSnapshots.english.commit,
      japaneseCommit: publicData.sourceSnapshots.japanese.commit,
      masterVersion: publicData.sourceSnapshots.english.masterVersion,
    },
  });
}
