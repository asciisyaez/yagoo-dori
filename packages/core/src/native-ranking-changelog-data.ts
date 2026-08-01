import nativeRankingChangelogJson from "../../../data/generated/native-ranking-changelog.json";

import {
  NativeRankingChangelogSchema,
  type NativeRankingChangelog,
} from "./native-ranking-changelog";

export const nativeRankingChangelogData: NativeRankingChangelog =
  NativeRankingChangelogSchema.parse(nativeRankingChangelogJson);
