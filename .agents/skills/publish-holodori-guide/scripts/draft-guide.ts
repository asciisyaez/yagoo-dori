import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { combinations, optimizeTeam } from "../../../../packages/core/src/optimizer";
import {
  representativeCharts,
  simulateTeam,
} from "../../../../packages/core/src/simulator";
import type {
  LeaderOutfit,
  MemberCard,
  SkillEffect,
  SourceRecord,
  Talent,
} from "../../../../packages/core/src/schemas";

const DISCLAIMER =
  "Unofficial fan site; not affiliated with COVER Corp. or QualiArts.";
const root = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveOne<T>(
  query: string,
  values: T[],
  labels: (value: T) => string[],
  kind: string,
): T {
  const needle = normalized(query);
  const exact = values.filter((value) =>
    labels(value).some((label) => normalized(label) === needle),
  );
  const matches =
    exact.length > 0
      ? exact
      : values.filter((value) =>
          labels(value).some((label) => normalized(label).includes(needle)),
        );
  if (matches.length !== 1) {
    const choices = matches.length > 0 ? matches : values;
    const rendered = choices
      .map((value) => `- ${labels(value).slice(0, 2).join(" | ")}`)
      .join("\n");
    throw new Error(
      `${kind} query "${query}" resolved to ${matches.length} records. Choose one exact ID or slug:\n${rendered}`,
    );
  }
  return matches[0]!;
}

function formatNumber(value: number) {
  return Number(value.toFixed(2));
}

function scoreTeam(
  cards: MemberCard[],
  leader: LeaderOutfit,
  investment: number,
) {
  return simulateTeam(
    cards,
    leader,
    representativeCharts[0]!,
    investment,
    "manual",
  ).total;
}

function constrainedStandard(
  cards: MemberCard[],
  anchor: MemberCard,
  leader: LeaderOutfit,
) {
  const teams = combinations(cards, 5).filter(
    (team) =>
      team.some((card) => card.id === anchor.id) &&
      team.filter((card) => card.rarity === 5).length <= 2,
  );
  if (teams.length === 0) {
    throw new Error("No legal standard formation contains the exact anchor");
  }
  return teams
    .map((team) => ({ cards: team, score: scoreTeam(team, leader, 1) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.cards
          .map((card) => card.id)
          .sort()
          .join("|")
          .localeCompare(
            right.cards
              .map((card) => card.id)
              .sort()
              .join("|"),
          ),
    )[0]!;
}

function replacementLoss(score: number, ceiling: number) {
  return formatNumber(Math.max(0, ((ceiling - score) / ceiling) * 100));
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

const anchorQuery = option("--anchor");
if (!anchorQuery) {
  throw new Error("Pass --anchor with a 5-star card ID, slug, title, or talent");
}

const talents = readJson<Talent[]>("data/talents.json");
const cards = readJson<MemberCard[]>("data/cards.json");
const leaders = readJson<LeaderOutfit[]>("data/leaders.json");
const skills = readJson<SkillEffect[]>("data/skills.json");
const sources = readJson<SourceRecord[]>("data/sources.json");
const talentById = new Map(talents.map((talent) => [talent.id, talent]));
const skillById = new Map(skills.map((skill) => [skill.id, skill]));
const sourceById = new Map(sources.map((source) => [source.id, source]));

const fiveStars = cards.filter((card) => card.rarity === 5);
const anchor = resolveOne(
  anchorQuery,
  fiveStars,
  (card) => [
    card.id,
    card.slug,
    card.title,
    talentById.get(card.talentId)?.name ?? card.talentId,
  ],
  "5-star Member card",
);
const leaderCandidates = leaders.filter(
  (leader) => leader.talentId === anchor.talentId,
);
const leaderQuery = option("--leader");
const leader = leaderQuery
  ? resolveOne(
      leaderQuery,
      leaders,
      (item) => [
        item.id,
        item.slug,
        item.title,
        item.outfitName,
        talentById.get(item.talentId)?.name ?? item.talentId,
      ],
      "Leader/Outfit",
    )
  : leaderCandidates.length === 1
    ? leaderCandidates[0]!
    : resolveOne(
        talentById.get(anchor.talentId)?.name ?? anchor.talentId,
        leaderCandidates,
        (item) => [item.id, item.slug, item.title, item.outfitName],
        "Leader/Outfit",
      );

const chart = representativeCharts[0]!;
const premium = optimizeTeam({
  cards,
  leader,
  chart,
  investment: 1,
  mode: "manual",
  anchorCardId: anchor.id,
});
const standard = constrainedStandard(cards, anchor, leader);
const accessiblePool = cards.filter(
  (card) => card.rarity === 4 || card.id === anchor.id,
);
const accessible = optimizeTeam({
  cards: accessiblePool,
  leader,
  chart,
  investment: 1,
  mode: "manual",
  anchorCardId: anchor.id,
});
const evidenceGrade =
  [anchor.verificationState, leader.verificationState].every((state) =>
    ["verified", "corroborated"].includes(state),
  )
    ? "corroborated"
    : "research-only";
const illustrative = anchor.illustrative || leader.illustrative;
const citedSourceIds = [...new Set([...anchor.sourceIds, ...leader.sourceIds])];
const citedSources = citedSourceIds.map((id) => {
  const source = sourceById.get(id);
  if (!source) throw new Error(`Missing source ${id}`);
  return source;
});
const anchorTalent = talentById.get(anchor.talentId);
if (!anchorTalent) throw new Error(`Missing talent ${anchor.talentId}`);

const formations = [
  { label: "Premium", result: premium },
  { label: "Standard", result: standard },
  { label: "4-star accessible", result: accessible },
];
for (const formation of formations) {
  if (
    formation.result.cards.length !== 5 ||
    new Set(formation.result.cards.map((card) => card.id)).size !== 5 ||
    !formation.result.cards.some((card) => card.id === anchor.id)
  ) {
    throw new Error(`${formation.label} formation is not a legal anchored team`);
  }
}
if (
  accessible.cards.some(
    (card) => card.id !== anchor.id && card.rarity !== 4,
  )
) {
  throw new Error("Accessible formation contains a non-anchor 5-star card");
}

const today = [anchor.retrievedAt, leader.retrievedAt].sort().at(-1)!;
const slug = `${anchor.slug}-${leader.slug}-draft`;
const skillTiming = anchor.skillIds
  .map((id) => skillById.get(id))
  .filter((skill): skill is SkillEffect => Boolean(skill))
  .map(
    (skill) =>
      `${skill.name}: ${skill.trigger}, ${skill.timingWindow}, ${skill.durationSeconds}s.`,
  )
  .join(" ");
const investmentOrder = standard.cards
  .slice()
  .sort(
    (left, right) =>
      right.progression.at(-1)!.power - left.progression.at(-1)!.power ||
      left.id.localeCompare(right.id),
  )
  .map((card) => card.id);

const sections = formations
  .map(({ label, result }) => {
    const loss = replacementLoss(result.score, premium.score);
    return `## ${label}

- Members: ${result.cards.map((card) => `\`${card.id}\``).join(", ")}
- Projected score: ${formatNumber(result.score)} (${illustrative ? "illustrative research fixture" : evidenceGrade})
- Projected replacement loss versus premium: ${loss}%
- Anchor retained: \`${anchor.id}\`
`;
  })
  .join("\n");

const mdx = `---
title: ${yamlString(`${anchorTalent.name}: ${anchor.title}`)}
slug: ${yamlString(slug)}
draft: true
publication: "manual-review-required"
anchorCardId: ${yamlString(anchor.id)}
leaderOutfitId: ${yamlString(leader.id)}
patchId: ${yamlString(anchor.patchId)}
lens: "standard-manual"
evidenceGrade: ${yamlString(evidenceGrade)}
theorycraftBeta: true
illustrative: ${illustrative}
retrievedAt: ${yamlString(today)}
---

> ${DISCLAIMER}

> **Theorycraft Beta.** Quantitative and reproducible under published assumptions; not universally objective.${illustrative ? " The numerical inputs are illustrative research fixtures and are not a game recommendation." : ""}

# ${anchorTalent.name}: ${anchor.title}

Exact anchor: \`${anchor.id}\` (5-star Member)  
Leader/Outfit: \`${leader.id}\` — ${leader.title} / ${leader.outfitName}

${sections}
## Skill timing

${skillTiming || "No verified timing note is available; keep this section provisional."}

## Chart fit

- Representative context: \`${chart.id}\`
- Preferred types: ${leader.preferredTypes.join(", ")}
- Shared synergy tags: ${anchor.synergyTags.filter((tag) => leader.synergyTags.includes(tag)).join(", ") || "none recorded"}

## Investment order

${investmentOrder.map((id, index) => `${index + 1}. \`${id}\``).join("\n")}

## Assumptions

- One copy of each card and duplicate-free maximum progression.
- Neutral collection and board assumptions.
- Perfect manual execution and no event-specific bonus.
- Published 70/30 representative chart corpus; this draft displays \`${chart.id}\`.

## Evidence and sources

- Evidence grade: **${evidenceGrade}**
${citedSources.map((source) => `- [${source.title}](${source.url}) — ${source.kind}; ${source.reusePolicy}; upstream ${source.upstreamVersion}.`).join("\n")}

## Guide changelog

- ${today}: Generated an unpublished draft from patch \`${anchor.patchId}\`; exact anchor and Leader resolved; optimizer formations recalculated.
`;

const required = [
  DISCLAIMER,
  "Theorycraft Beta",
  "## Premium",
  "## Standard",
  "## 4-star accessible",
  "## Skill timing",
  "## Chart fit",
  "## Investment order",
  "## Evidence and sources",
  "## Guide changelog",
  `anchorCardId: ${yamlString(anchor.id)}`,
  `leaderOutfitId: ${yamlString(leader.id)}`,
];
for (const marker of required) {
  if (!mdx.includes(marker)) throw new Error(`Draft is missing ${marker}`);
}

const output = option("--output");
if (output) {
  const absolute = resolve(root, output);
  const allowed = resolve(root, "content/guides");
  const withinAllowed =
    absolute === allowed || (!relative(allowed, absolute).startsWith("..") && !isAbsolute(relative(allowed, absolute)));
  if (!withinAllowed || !absolute.endsWith(".mdx")) {
    throw new Error("--output must be an .mdx file beneath content/guides");
  }
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, mdx, "utf8");
  console.log(`Wrote unpublished MDX draft: ${relative(root, absolute)}`);
} else {
  console.log(mdx);
}

console.error(
  `Validated draft: anchor=${anchor.id}, leader=${leader.id}, formations=3, chart=${chart.id}, publication=blocked`,
);
