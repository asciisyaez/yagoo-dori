import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = join(root, "data", "generated", "holodori-public.json");
const assetManifestFile = join(root, "data", "generated", "card-art-manifest.json");
const artDirectory = join(root, "apps", "web", "public", "game", "cards");
const illustrationDirectory = join(root, "apps", "web", "public", "game", "illustrations");

const sources = {
  english: {
    repository: "https://github.com/HolodoriDB/holodori-db-eng-diff",
    commit: "060e4c3342a6005ddee94860dd090d24c417c092",
    masterVersion: "24afa2c641f4a831c024ac2e912972b2accb695ad0dd3a63fc47a2ffaa69e121",
  },
  japanese: {
    repository: "https://github.com/HolodoriDB/holodori-db-jpn-diff",
    commit: "86dfcc47e5cffa4baee72a53c98f7968af699620",
    masterVersion: "24afa2c641f4a831c024ac2e912972b2accb695ad0dd3a63fc47a2ffaa69e121",
  },
  art: {
    page: "https://game8.jp/hololive-dreams/800509",
    label: "Game8 public Member-card index",
  },
  editorialTier: {
    page: "https://appmedia.jp/hololive-dreams/80235364",
    label: "AppMedia score-performance tier snapshot",
    updatedAt: "2026-07-30T15:44:00+09:00",
  },
};

const retrievedAt = process.argv
  .find((argument) => argument.startsWith("--retrieved-at="))
  ?.split("=")[1] ?? new Date().toISOString().slice(0, 10);
const skipArt = process.argv.includes("--skip-art");

const englishFiles = [
  "Card.json",
  "CardLevel.json",
  "Character.json",
  "CharacterGrouping.json",
  "Costume.json",
  "LangCard_Eng.json",
  "LangCharacterGrouping_Eng.json",
  "LangCostume_Eng.json",
  "LangGeneratedLiveActiveSkillLevel_Eng.json",
  "LangGeneratedLiveLeaderSkill_Eng.json",
  "LangGeneratedLivePassiveSkillLevel_Eng.json",
  "LangGeneratedLiveSpecialSkillLevel_Eng.json",
  "LiveActiveSkillLevel.json",
  "LiveLeaderSkill.json",
  "LivePassiveSkillLevel.json",
  "LiveSpecialSkillLevel.json",
];

const japaneseFiles = ["LangCard_Jpn.json"];

function rawUrl(source, file) {
  return `${source.repository.replace("github.com", "raw.githubusercontent.com")}/${source.commit}/${file}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Yagoo-dori public-data indexer (+https://yagoo-dori.cc)",
      accept: "text/html,application/json,image/avif,image/webp,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

async function fetchJsonSet(source, files) {
  const pairs = await Promise.all(
    files.map(async (file) => [file, JSON.parse(await fetchText(rawUrl(source, file)))]),
  );
  return Object.fromEntries(pairs);
}

function dataMap(records, key = (record) => record.id) {
  return new Map(records.map((record) => [key(record), record.data]));
}

function languageMap(...tables) {
  return new Map(
    tables.flat().map((record) => [record.data.id, cleanText(record.data.text)]),
  );
}

function cleanText(value = "") {
  return value
    .replace(/\[(?:\/)?highlight\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeForMatch(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s"'’‘“”`´・.,!?！？♪☆★[\]［\]()（）:：/\\-]/g, "");
}

function rarityFrom(value) {
  const match = value.match(/RARITY_(\d)$/);
  return match ? Number(match[1]) : null;
}

const attributeNames = {
  CardAttributeType_CARD_ATTRIBUTE_TYPE_ATTRIBUTE_1: "cute",
  CardAttributeType_CARD_ATTRIBUTE_TYPE_ATTRIBUTE_2: "pure",
  CardAttributeType_CARD_ATTRIBUTE_TYPE_ATTRIBUTE_3: "happy",
};

function branchFrom(productionId) {
  if (productionId === "prd-en") return "hololive English";
  if (productionId === "prd-id") return "hololive Indonesia";
  return "hololive Japan";
}

function indexLevels(records, idField) {
  const result = new Map();
  for (const record of records) {
    const id = record.data[idField];
    const levels = result.get(id) ?? [];
    levels.push(record.data);
    result.set(id, levels);
  }
  for (const levels of result.values()) {
    levels.sort((left, right) => Number(left.level) - Number(right.level));
  }
  return result;
}

function skillView(level, descriptions) {
  if (!level) return null;
  return {
    level: Number(level.level),
    description: descriptions.get(level.descriptionLangId) ?? null,
    effectGroupId: level.liveActiveSkillEffectGroupId ?? level.livePassiveSkillEffectGroupId ?? null,
    triggerGroupId: level.liveSkillTriggerGroupId ?? null,
    additionalEffectGroupId:
      level.additionalLiveActiveSkillEffectGroupId ??
      level.additionalLivePassiveSkillEffectGroupId ??
      null,
    additionalTriggerGroupId: level.additionalLiveSkillTriggerGroupId ?? null,
    cooldownSeconds:
      level.coolTimeMillisecond === undefined ? null : level.coolTimeMillisecond / 1000,
    durationSeconds:
      level.effectDurationMillisecond === undefined ? null : level.effectDurationMillisecond / 1000,
    activationProbability:
      level.activationProbabilityPermilMultiply === undefined
        ? null
        : level.activationProbabilityPermilMultiply / 1000,
  };
}

function parseImageTags(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((match) => [match[1], match[2]]),
    );
    return attributes;
  });
}

const baseTierByTalent = {
  SS: [
    "Nakiri Ayame",
    "Oozora Subaru",
    "Houshou Marine",
    "Yukihana Lamy",
    "Momosuzu Nene",
    "Shishiro Botan",
    "Takanashi Kiara",
    "Ouro Kronii",
    "Mococo Abyssgard",
  ],
  S: [
    "AZKi",
    "Hoshimachi Suisei",
    "Shirakami Fubuki",
    "Natsuiro Matsuri",
    "Ookami Mio",
    "Shiranui Flare",
    "Tsunomaki Watame",
    "Tokoyami Towa",
    "Himemori Luna",
    "Omaru Polka",
    "Hakui Koyori",
    "Kazama Iroha",
    "Moona Hoshinova",
    "Pavolia Reine",
    "Vestia Zeta",
    "Mori Calliope",
    "Shiori Novella",
    "Otonose Kanade",
    "Ichijou Ririka",
    "Juufuutei Raden",
    "Todoroki Hajime",
  ],
};

const eventTierByCardId = {
  "card-00012-5-uniq-0062-00": "A",
  "card-00021-5-uniq-0064-00": "S",
  "card-00022-5-uniq-0063-00": "SS",
  "card-00026-5-uniq-0065-00": "S",
  "card-06002-5-uniq-0066-00": "A",
};

const artOverrideByCardId = {
  "card-04016-5-uniq-0055-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800509",
    iconSourceUrl: "https://img.game8.jp/12790222/2095ecb167fd7d0dbb759da7ca00f450.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12791423/9b94418b4ccd3acf74d0f502701c0702.webp/show",
  },
  "card-03008-5-uniq-0040-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800509",
    iconSourceUrl: "https://img.game8.jp/12790207/54d51bc8536b4d86203b2407238b16d7.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12791393/65a793e03386f01811e2177f6622a52c.webp/show",
  },
  "card-04013-5-uniq-0052-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800509",
    iconSourceUrl: "https://img.game8.jp/12790216/e60faf0d1e000f3351340596fde9fc49.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12791388/8f233884d713333fdb61ae8094bb140d.webp/show",
  },
  "card-06003-4-cmmn-0000-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800509",
    iconSourceUrl: "https://img.game8.jp/12791114/dbc9a55bed9998af1fd92b9408ae4dcc.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12791639/14766191b6e6dbde2d6ac8574914475c.webp/show",
  },
  "card-00012-5-uniq-0062-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800904",
    iconSourceUrl: "https://img.game8.jp/12810700/46b9c009f92daccfdd67a99e03b5efc3.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12809463/c46040bb3aca8666765338376817c7df.webp/show",
  },
  "card-06002-5-uniq-0066-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800904",
    iconSourceUrl: "https://img.game8.jp/12810699/09345b620c704e4b660e301b2c8df807.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12809557/2a1ec7bd3af75d3873b9a40562588afd.webp/show",
  },
  "card-00021-5-uniq-0064-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800904",
    iconSourceUrl: "https://img.game8.jp/12810701/87ec8d34d63e8147ba54f7f6cfab7c30.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12809476/6e9648c8cfad8b1f8ba2ca79b0ff6c58.webp/show",
  },
  "card-00022-5-uniq-0063-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800904",
    iconSourceUrl: "https://img.game8.jp/12810698/6eb78c6e9f2234ec3339f058769de58e.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12809493/1ef646d169f0645fa13e8937fa0efc4d.webp/show",
  },
  "card-00026-5-uniq-0065-00": {
    sourcePage: "https://game8.jp/hololive-dreams/800904",
    iconSourceUrl: "https://img.game8.jp/12810702/5ce5358133f24551a4235eed64b58601.webp/original",
    illustrationSourceUrl: "https://img.game8.jp/12809533/89a65fb59833b97f479bc624fc9872df.webp/show",
  },
};

function editorialTier(cardId, talentName, rarity) {
  if (rarity !== 5) return null;
  if (eventTierByCardId[cardId]) return eventTierByCardId[cardId];
  if (baseTierByTalent.SS.includes(talentName)) return "SS";
  if (baseTierByTalent.S.includes(talentName)) return "S";
  return "A";
}

async function downloadArt(cards) {
  const html = await fetchText(sources.art.page);
  const images = parseImageTags(html)
    .filter((image) => image["data-src"]?.includes("img.game8.jp"))
    .filter((image) => image.alt && !image.alt.includes("アイコン"));
  const icons = images
    .filter((image) => image["data-src"]?.endsWith("/original"))
    .filter((image) => Number(image.width) === 60);
  const illustrations = images
    .filter((image) => image["data-src"]?.includes("img.game8.jp"))
    .filter((image) => image["data-src"]?.endsWith("/show"))
    .filter((image) => Number(image.width) >= 600);

  await mkdir(artDirectory, { recursive: true });
  await mkdir(illustrationDirectory, { recursive: true });
  const manifest = [];

  for (const card of cards) {
    const override = artOverrideByCardId[card.id];
    const iconMatch = icons.find((image) =>
      normalizeForMatch(image.alt).includes(normalizeForMatch(card.titleJa)),
    );
    const illustrationMatch = illustrations.find((image) =>
      normalizeForMatch(image.alt).includes(normalizeForMatch(card.titleJa)),
    );
    if ((!iconMatch || !illustrationMatch) && !override) {
      manifest.push({
        cardId: card.id,
        status: "missing",
        sourcePage: sources.art.page,
        sourceUrl: null,
        localPath: null,
        retrievedAt,
      });
      continue;
    }

    const iconSourceUrl = override?.iconSourceUrl ?? iconMatch["data-src"];
    const illustrationSourceUrl =
      override?.illustrationSourceUrl ?? illustrationMatch["data-src"];
    const sourcePage = override?.sourcePage ?? sources.art.page;
    const iconPath = `/game/cards/${card.id}.webp`;
    const illustrationPath = `/game/illustrations/${card.id}.webp`;

    async function download(sourceUrl, absolutePath) {
      const response = await fetch(sourceUrl, {
        headers: { "user-agent": "Mozilla/5.0 Yagoo-dori/1.0" },
      });
      if (!response.ok) {
        throw new Error(`Art download failed ${response.status}: ${sourceUrl}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(absolutePath, bytes);
      return {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }

    const icon = await download(iconSourceUrl, join(artDirectory, `${card.id}.webp`));
    const illustration = await download(
      illustrationSourceUrl,
      join(illustrationDirectory, `${card.id}.webp`),
    );
    card.artPath = iconPath;
    card.illustrationPath = illustrationPath;
    manifest.push({
      cardId: card.id,
      status: "downloaded",
      sourcePage,
      retrievedAt,
      icon: { sourceUrl: iconSourceUrl, localPath: iconPath, ...icon },
      illustration: {
        sourceUrl: illustrationSourceUrl,
        localPath: illustrationPath,
        ...illustration,
      },
    });
  }

  return manifest;
}

const [english, japanese] = await Promise.all([
  fetchJsonSet(sources.english, englishFiles),
  fetchJsonSet(sources.japanese, japaneseFiles),
]);

const characters = dataMap(english["Character.json"]);
const characterGroups = dataMap(english["CharacterGrouping.json"]);
const costumes = dataMap(english["Costume.json"]);
const englishText = languageMap(
  english["LangCard_Eng.json"],
  english["LangCharacterGrouping_Eng.json"],
  english["LangCostume_Eng.json"],
  english["LangGeneratedLiveActiveSkillLevel_Eng.json"],
  english["LangGeneratedLivePassiveSkillLevel_Eng.json"],
  english["LangGeneratedLiveSpecialSkillLevel_Eng.json"],
  english["LangGeneratedLiveLeaderSkill_Eng.json"],
);
const japaneseText = languageMap(japanese["LangCard_Jpn.json"]);
const activeLevels = indexLevels(english["LiveActiveSkillLevel.json"], "liveActiveSkillId");
const passiveLevels = indexLevels(english["LivePassiveSkillLevel.json"], "livePassiveSkillId");
const specialLevels = indexLevels(english["LiveSpecialSkillLevel.json"], "liveSpecialSkillId");
const leaderSkills = dataMap(english["LiveLeaderSkill.json"]);
const levelRows = indexLevels(english["CardLevel.json"], "groupId");

const cards = english["Card.json"]
  .map((record) => record.data)
  .filter((card) => [4, 5].includes(rarityFrom(card.rarity)))
  .map((card) => {
    const character = characters.get(card.characterId);
    const costume = costumes.get(card.rewardCostumeId);
    const rarity = rarityFrom(card.rarity);
    const title = englishText.get(card.nameLangId);
    const titleJa = japaneseText.get(card.nameLangId);
    const maxLevelRow = levelRows.get(card.cardLevelGroupId)?.at(-1);
    const parameterBase = Number(maxLevelRow?.parameterBaseValue ?? 0);
    const maxPotentialMultiplier = rarity >= 4 ? 1.1 : 1;
    const leader = leaderSkills.get(costume?.liveLeaderSkillId);
    const active = activeLevels.get(card.liveActiveSkillId) ?? [];
    const passive = passiveLevels.get(card.livePassiveSkillId) ?? [];
    const special = specialLevels.get(card.liveSpecialSkillId) ?? [];
    const talentName = character?.nameEng ?? card.characterId;
    const groups = (character?.regularCharacterGroupingIds ?? [])
      .map((groupId) => characterGroups.get(groupId))
      .map((group) => englishText.get(group?.nameLangId))
      .filter(Boolean);

    return {
      id: card.id,
      slug: slugify(`${talentName}-${title}-${card.id}`),
      talentId: card.characterId,
      talentName,
      title,
      titleJa,
      rarity,
      attribute: attributeNames[card.attributeType],
      generation: groups[0] ?? character?.regularCharacterGroupingNameEng ?? "Unknown",
      groups,
      branch: branchFrom(character?.characterProductionId),
      color: `#${character?.color1 ?? "58c8e8"}`,
      assetId: card.assetId,
      artPath: null,
      illustrationPath: null,
      maxLevel: Number(maxLevelRow?.level ?? 0),
      parameterDistribution: {
        performance: card.performancePermilMultiply / 1000,
        technique: card.techniquePermilMultiply / 1000,
        sense: card.sensePermilMultiply / 1000,
      },
      parameters: {
        oneCopyMaxLevel: {
          performance: Math.ceil(parameterBase * card.performancePermilMultiply / 1000),
          technique: Math.ceil(parameterBase * card.techniquePermilMultiply / 1000),
          sense: Math.ceil(parameterBase * card.sensePermilMultiply / 1000),
        },
        maxPotential: {
          performance: Math.ceil(parameterBase * card.performancePermilMultiply / 1000 * maxPotentialMultiplier),
          technique: Math.ceil(parameterBase * card.techniquePermilMultiply / 1000 * maxPotentialMultiplier),
          sense: Math.ceil(parameterBase * card.sensePermilMultiply / 1000 * maxPotentialMultiplier),
        },
      },
      skills: {
        active: active.map((level) => skillView(level, englishText)),
        passive: passive.map((level) => skillView(level, englishText)),
        special: special.map((level) => skillView(level, englishText)),
      },
      leaderOutfit: {
        costumeId: costume?.id ?? card.rewardCostumeId,
        costumeName: englishText.get(costume?.nameLangId) ?? title,
        description: englishText.get(leader?.descriptionLangId) ?? null,
        effectGroupId: leader?.livePassiveSkillEffectGroupId ?? null,
        triggerGroupId: leader?.liveSkillTriggerGroupId ?? null,
        additionalEffectGroupId: leader?.additionalLivePassiveSkillEffectGroupId ?? null,
        additionalTriggerGroupId: leader?.additionalLiveSkillTriggerGroupId ?? null,
      },
      editorialTier: editorialTier(card.id, talentName, rarity),
    };
  })
  .sort((left, right) => {
    if (left.rarity !== right.rarity) return right.rarity - left.rarity;
    return left.talentName.localeCompare(right.talentName) || left.id.localeCompare(right.id);
  });

const manifest = skipArt
  ? JSON.parse(await readFile(assetManifestFile, "utf8"))
  : await downloadArt(cards);

const payload = {
  schemaVersion: 1,
  retrievedAt,
  sourceSnapshots: sources,
  counts: {
    talents: new Set(cards.map((card) => card.talentId)).size,
    fourStar: cards.filter((card) => card.rarity === 4).length,
    fiveStar: cards.filter((card) => card.rarity === 5).length,
    total: cards.length,
    art: manifest.filter((entry) => entry.status === "downloaded").length,
  },
  notes: [
    "HolodoriDB tables are joined by explicit IDs and pinned commits.",
    "One-copy parameters use the maximum level curve without duplicate Potential bonuses.",
    "Max-Potential parameters apply the rarity 4/5 10% all-parameter Potential bonus.",
    "Editorial tiers reproduce the cited AppMedia score-performance snapshot and are not Yagoo-dori calculations.",
  ],
  cards,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(assetManifestFile, `${JSON.stringify({ retrievedAt, source: sources.art, assets: manifest }, null, 2)}\n`);

const missingArt = manifest.filter((entry) => entry.status !== "downloaded");
console.log(`Normalized ${cards.length} cards (${payload.counts.fiveStar} five-star, ${payload.counts.fourStar} four-star).`);
console.log(`Downloaded ${payload.counts.art} card-art files; ${missingArt.length} unresolved.`);
if (missingArt.length > 0) {
  console.log(`Missing: ${missingArt.map((entry) => entry.cardId).join(", ")}`);
  process.exitCode = 1;
}
