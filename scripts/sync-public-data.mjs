import { createHash } from "node:crypto";
import { illustrationFloorExceptionByCardId } from "./lib/illustration-floor-exceptions.mjs";
import { fetchGithubRaw } from "./lib/fetch-github-raw.mjs";
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
    commit: "a15150a8b7413f035f28f8f85d63ab9df122c380",
    masterVersion: "71e11fbd082eec83d10cff35da7179cbaf319097f0021aa5747fe5a5392b549c",
  },
  japanese: {
    repository: "https://github.com/HolodoriDB/holodori-db-jpn-diff",
    commit: "84cb500d8ebf19e306be20faba696123018e49a8",
    masterVersion: "71e11fbd082eec83d10cff35da7179cbaf319097f0021aa5747fe5a5392b549c",
  },
  art: {
    page: "https://appmedia.jp/hololive-dreams",
    label: "AppMedia public Member-card pages",
    talentPageRange: {
      firstId: 80234830,
      lastId: 80234989,
      step: 3,
      expectedCount: 54,
    },
    fallback: {
      page: "https://game8.jp/hololive-dreams/800509",
      eventPage: "https://game8.jp/hololive-dreams/800904",
      label: "Game8 public Member-card index",
      policy: "Declared fallback only; preferred-source incompleteness fails the import.",
      illustrationVariant: "original",
    },
  },
};

const retrievedAt = process.argv
  .find((argument) => argument.startsWith("--retrieved-at="))
  ?.split("=")[1] ?? new Date().toISOString().slice(0, 10);
const skipArt = process.argv.includes("--skip-art");

async function readExistingPublicData() {
  try {
    return JSON.parse(await readFile(outputFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

const existingPublicData = await readExistingPublicData();
const existingCardById = new Map(
  (existingPublicData?.cards ?? []).map((card) => [card.id, card]),
);

function firstSeenAtFor(cardId) {
  const existingCard = existingCardById.get(cardId);
  if (existingCard) {
    return Object.prototype.hasOwnProperty.call(existingCard, "firstSeenAt")
      ? existingCard.firstSeenAt
      : existingPublicData.retrievedAt;
  }
  return retrievedAt;
}

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

const japaneseFiles = ["LangCard_Jpn.json", "LangCharacter_Jpn.json"];

const minimumCardAssetCount = 120;
const minimumIllustrationDimensions = { width: 2282, height: 1284 };
const requiredIconDimensions = { width: 300, height: 300 };

function rawUrl(source, file) {
  return `${source.repository.replace("github.com", "raw.githubusercontent.com")}/${source.commit}/${file}`;
}

async function fetchPublic(url, accept) {
  return fetchGithubRaw(url, {
    accept,
    userAgent: "Yagoo-dori public-data indexer (+https://github.com/asciisyaez/yagoo-dori)",
  });
}

async function fetchText(url) {
  return (await fetchPublic(url, "text/html,application/json;q=0.9,*/*;q=0.5")).text();
}

async function fetchBytes(url) {
  return Buffer.from(
    await (await fetchPublic(url, "image/avif,image/webp,image/*;q=0.9,*/*;q=0.5")).arrayBuffer(),
  );
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

function decodeHtml(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
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
    .replace(/[\p{P}\p{S}\p{Z}\s]/gu, "");
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

function webpDimensions(bytes, label) {
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error(`${label}: expected a WebP image`);
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString("ascii", offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === "VP8X" && chunkLength >= 10) {
      return {
        width: 1 + bytes.readUIntLE(dataOffset + 4, 3),
        height: 1 + bytes.readUIntLE(dataOffset + 7, 3),
      };
    }
    if (chunkType === "VP8L" && chunkLength >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height:
          1 +
          ((bytes[dataOffset + 2] & 0xc0) >> 6) +
          (bytes[dataOffset + 3] << 2) +
          ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }
    if (
      chunkType === "VP8 " &&
      chunkLength >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkLength + (chunkLength % 2);
  }

  throw new Error(`${label}: WebP dimensions could not be decoded`);
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
      [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [
        match[1].toLowerCase(),
        decodeHtml(match[3]),
      ]),
    );
    return attributes;
  });
}

const appMediaAssetOverrideByCardId = {
  "card-00005-5-uniq-0006-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234848",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/01/121022_jka0l.webp",
    illustrationSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/185321_4723g.webp",
  },
  "card-00032-5-uniq-0026-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234902",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/01/122208_iturw.webp",
    illustrationSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/190152_296fi.webp",
  },
  "card-04001-5-uniq-0042-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234947",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/124146_zi71m.webp",
    illustrationSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/190157_gnrx9.webp",
  },
  "card-04012-4-cmmn-0000-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234962",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/143818_hxwlf.webp",
    illustrationSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/193928_apfbq.webp",
  },
  "card-00010-5-uniq-0069-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234857",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/08/185143_uiys0.webp",
    illustrationSourcePage: "https://game8.jp/hololive-dreams/800904",
    illustrationSourceUrl: "https://img.game8.jp/12889920/2ba810a9253cd60b2acd30d711aabbed.webp/original",
    allowExternalIllustration: true,
  },
  "card-00028-5-uniq-0070-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234893",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/08/191914_5usrx.webp",
    illustrationSourcePage: "https://game8.jp/hololive-dreams/800904",
    illustrationSourceUrl: "https://img.game8.jp/12889919/9b0c9885dcc2f797a28b7f26912175bb.webp/original",
    allowExternalIllustration: true,
  },
  "card-03004-5-uniq-0073-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234929",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/08/192325_7id4n.webp",
    illustrationSourcePage: "https://game8.jp/hololive-dreams/800904",
    illustrationSourceUrl: "https://img.game8.jp/12889917/7f2a51cf6ed8c5a249687f0590d3fe81.webp/original",
    allowExternalIllustration: true,
  },
  "card-04001-5-uniq-0071-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234947",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/07/110743_u7wr6.webp",
    illustrationSourcePage: "https://game8.jp/hololive-dreams/800904",
    illustrationSourceUrl: "https://img.game8.jp/12889915/765bcaaf45ee28fa51aa3db3fe788bae.webp/original",
    allowExternalIllustration: true,
  },
  "card-04003-5-uniq-0072-00": {
    sourcePage: "https://appmedia.jp/hololive-dreams/80234953",
    iconSourceUrl: "https://appmedia.jp/wp-content/uploads/2026/08/191920_b285p.webp",
    illustrationSourcePage: "https://game8.jp/hololive-dreams/800904",
    illustrationSourceUrl: "https://img.game8.jp/12889918/ca975d5a23735214d3e4afa3630d1bcb.webp/original",
    allowExternalIllustration: true,
  },
};

const appMediaTitleAliasByCardId = {
  // AppMedia omits ラ from ラビット in this title.
  "card-00019-5-uniq-0016-00": "愛嬌たっぷりビットフィールド",
  // AppMedia writes 探究心 where the pinned Japanese game table writes 探求心.
  "card-04013-5-uniq-0052-00": "書庫ではぐくむ探究心",
  // AppMedia renders ホッと as the katakana ホット.
  "card-04016-4-cmmn-0000-00": "ホット安らぐフワワライブ",
};

function appMediaTalentPageUrls(indexHtml) {
  const { firstId, lastId, step, expectedCount } = sources.art.talentPageRange;
  const expectedUrls = [];
  for (let id = firstId; id <= lastId; id += step) {
    expectedUrls.push(`https://appmedia.jp/hololive-dreams/${id}`);
  }
  if (expectedUrls.length !== expectedCount) {
    throw new Error(`AppMedia talent-page range produced ${expectedUrls.length}, expected ${expectedCount}`);
  }

  const indexedUrls = new Set(
    [...indexHtml.matchAll(/href\s*=\s*(["'])(https:\/\/appmedia\.jp\/hololive-dreams\/(\d+)\/?)(?:\1)/gi)]
      .map((match) => match[2].replace(/\/$/, "")),
  );
  const missingPages = expectedUrls.filter((url) => !indexedUrls.has(url));
  if (missingPages.length > 0) {
    throw new Error(`AppMedia index is missing ${missingPages.length} expected talent pages: ${missingPages.join(", ")}`);
  }
  return expectedUrls;
}

function appMediaImages(html, sourcePage) {
  return parseImageTags(html).flatMap((image) => {
    const rawSourceUrl = image["data-src"] ?? image["data-lazy-src"] ?? image.src;
    if (!image.alt || !rawSourceUrl) return [];

    const sourceUrl = new URL(rawSourceUrl, sourcePage);
    if (
      sourceUrl.origin !== "https://appmedia.jp" ||
      !sourceUrl.pathname.startsWith("/wp-content/uploads/") ||
      !sourceUrl.pathname.endsWith(".webp")
    ) {
      return [];
    }

    return [{
      alt: image.alt.trim(),
      normalizedAlt: normalizeForMatch(image.alt),
      sourcePage,
      sourceUrl: sourceUrl.href,
    }];
  });
}

function uniqueMatches(matches) {
  return [...new Map(matches.map((match) => [`${match.sourcePage}\0${match.sourceUrl}`, match])).values()];
}

function requireSingleMatch(card, kind, matches) {
  const unique = uniqueMatches(matches);
  if (unique.length !== 1) {
    const detail = unique
      .map((match) => `\n  alt="${match.alt}" page=${match.sourcePage} src=${match.sourceUrl}`)
      .join("");
    throw new Error(
      `${card.id}: expected one AppMedia ${kind} match for "${card.titleJa}", found ${unique.length}${detail}`,
    );
  }
  return unique[0];
}

function validateManifestCoverage(cards, manifest) {
  if (cards.length < minimumCardAssetCount) {
    throw new Error(`Expected at least ${minimumCardAssetCount} cards, found ${cards.length}`);
  }
  if (!Array.isArray(manifest) || manifest.length !== cards.length) {
    throw new Error(`Expected ${cards.length} asset manifest records, found ${manifest?.length ?? 0}`);
  }

  const expectedIds = new Set(cards.map((card) => card.id));
  const manifestIds = manifest.map((asset) => asset.cardId);
  const duplicateIds = manifestIds.filter((cardId, index) => manifestIds.indexOf(cardId) !== index);
  const missingIds = [...expectedIds].filter((cardId) => !manifestIds.includes(cardId));
  const unexpectedIds = manifestIds.filter((cardId) => !expectedIds.has(cardId));
  if (duplicateIds.length || missingIds.length || unexpectedIds.length) {
    throw new Error(
      `Asset manifest coverage mismatch; duplicates=${[...new Set(duplicateIds)].join(",") || "none"}; ` +
      `missing=${missingIds.join(",") || "none"}; unexpected=${unexpectedIds.join(",") || "none"}`,
    );
  }
}

async function downloadArt(cards, talentNameJaById) {
  const indexHtml = await fetchText(sources.art.page);
  const pageUrls = appMediaTalentPageUrls(indexHtml);
  const pages = await mapWithConcurrency(pageUrls, 6, async (sourcePage) => ({
    sourcePage,
    images: appMediaImages(await fetchText(sourcePage), sourcePage),
  }));
  const pageByUrl = new Map(pages.map((page) => [page.sourcePage, page]));
  const allImages = pages.flatMap((page) => page.images);

  const mappings = cards.map((card) => {
    const talentNameJa = talentNameJaById.get(card.talentId);
    if (!talentNameJa) throw new Error(`${card.id}: missing Japanese talent name`);

    const sourceTitle = appMediaTitleAliasByCardId[card.id] ?? card.titleJa;
    const titleNeedle = normalizeForMatch(sourceTitle);
    const talentNeedle = normalizeForMatch(talentNameJa);
    const belongsToCard = (image) =>
      image.normalizedAlt.includes(titleNeedle) && image.normalizedAlt.includes(talentNeedle);
    const isIllustration = (image) => /_イラスト$/u.test(image.alt);
    const isThreeDimensional = (image) => /_3d$/iu.test(image.alt);
    // AppMedia article-link thumbnails ("…のスキルとステータス") carry both the
    // title and talent needles but are never the card icon.
    const isArticleThumbnail = (image) => /のスキルとステータス$/u.test(image.alt);
    const override = appMediaAssetOverrideByCardId[card.id];

    let illustration;
    let illustrationMatchMethod;
    if (override) {
      const overridePage = pageByUrl.get(override.sourcePage);
      if (!overridePage) throw new Error(`${card.id}: override page is outside the pinned talent-page set`);
      if (!overridePage.images.some((image) => image.sourceUrl === override.iconSourceUrl)) {
        throw new Error(`${card.id}: AppMedia icon override is no longer present on the talent page`);
      }
      const detected = uniqueMatches(
        overridePage.images.filter((image) => belongsToCard(image) && isIllustration(image)),
      );
      if (
        !override.allowExternalIllustration &&
        (detected.length > 1 ||
          (detected.length === 1 && detected[0].sourceUrl !== override.illustrationSourceUrl))
      ) {
        throw new Error(`${card.id}: AppMedia illustration override disagrees with the talent page`);
      }
      illustration = {
        sourcePage: override.illustrationSourcePage ?? override.sourcePage,
        sourceUrl: override.illustrationSourceUrl,
      };
      illustrationMatchMethod = "explicit-media-override";
    } else {
      illustration = requireSingleMatch(
        card,
        "illustration",
        allImages.filter((image) => belongsToCard(image) && isIllustration(image)),
      );
      illustrationMatchMethod = appMediaTitleAliasByCardId[card.id]
        ? "normalized-source-title-alias-and-talent"
        : "normalized-japanese-title-and-talent";
    }

    const talentPage = pageByUrl.get(illustration.sourcePage);
    const icon = override
      ? {
          sourcePage: override.sourcePage,
          sourceUrl: override.iconSourceUrl,
          matchMethod: "explicit-media-override",
        }
      : {
          ...requireSingleMatch(
            card,
            "icon",
            talentPage.images.filter(
              (image) =>
                belongsToCard(image) &&
                !isIllustration(image) &&
                !isThreeDimensional(image) &&
                !isArticleThumbnail(image),
            ),
          ),
          matchMethod: appMediaTitleAliasByCardId[card.id]
            ? "normalized-source-title-alias-and-talent"
            : "normalized-japanese-title-and-talent",
        };
    if (icon.sourceUrl === illustration.sourceUrl) {
      throw new Error(`${card.id}: icon and illustration resolved to the same media URL`);
    }

    return {
      card,
      talentNameJa,
      icon,
      illustration: { ...illustration, matchMethod: illustrationMatchMethod },
    };
  });

  const iconUrls = mappings.map((mapping) => mapping.icon.sourceUrl);
  const illustrationUrls = mappings.map((mapping) => mapping.illustration.sourceUrl);
  if (new Set(iconUrls).size !== mappings.length || new Set(illustrationUrls).size !== mappings.length) {
    throw new Error("AppMedia resolved duplicate media URLs across card records");
  }

  const prepared = await mapWithConcurrency(mappings, 4, async (mapping) => {
    const [iconBytes, illustrationBytes] = await Promise.all([
      fetchBytes(mapping.icon.sourceUrl),
      fetchBytes(mapping.illustration.sourceUrl),
    ]);
    const iconDimensions = webpDimensions(iconBytes, `${mapping.card.id} icon`);
    const illustrationDimensions = webpDimensions(
      illustrationBytes,
      `${mapping.card.id} illustration`,
    );
    if (
      iconDimensions.width !== requiredIconDimensions.width ||
      iconDimensions.height !== requiredIconDimensions.height
    ) {
      throw new Error(
        `${mapping.card.id}: icon is ${iconDimensions.width}x${iconDimensions.height}; ` +
        `required ${requiredIconDimensions.width}x${requiredIconDimensions.height}`,
      );
    }
    const floorException = illustrationFloorExceptionByCardId[mapping.card.id];
    if (floorException) {
      if (
        illustrationDimensions.width !== floorException.exactWidth ||
        illustrationDimensions.height !== floorException.exactHeight
      ) {
        throw new Error(
          `${mapping.card.id}: illustration is ${illustrationDimensions.width}x${illustrationDimensions.height}; ` +
          `the documented floor exception pins exactly ${floorException.exactWidth}x${floorException.exactHeight} ` +
          `(source changed - re-review the exception)`,
        );
      }
    } else if (
      illustrationDimensions.width < minimumIllustrationDimensions.width ||
      illustrationDimensions.height < minimumIllustrationDimensions.height
    ) {
      throw new Error(
        `${mapping.card.id}: illustration is ${illustrationDimensions.width}x${illustrationDimensions.height}; ` +
        `minimum ${minimumIllustrationDimensions.width}x${minimumIllustrationDimensions.height} ` +
        `(source: ${mapping.illustration.sourceUrl})`,
      );
    }

    const iconPath = `/game/cards/${mapping.card.id}.webp`;
    const illustrationPath = `/game/illustrations/${mapping.card.id}.webp`;
    mapping.card.artPath = iconPath;
    mapping.card.illustrationPath = illustrationPath;

    const provenance = (assetClass, asset, localPath, bytes, dimensions) => ({
      assetClass,
      cardId: mapping.card.id,
      talentId: mapping.card.talentId,
      sourcePage: asset.sourcePage,
      sourceUrl: asset.sourceUrl,
      localPath,
      retrievedAt,
      matchMethod: asset.matchMethod,
      width: dimensions.width,
      height: dimensions.height,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });

    return {
      iconBytes,
      illustrationBytes,
      manifest: {
        cardId: mapping.card.id,
        talentId: mapping.card.talentId,
        talentNameJa: mapping.talentNameJa,
        status: "downloaded",
        retrievedAt,
        icon: provenance("card-icon", mapping.icon, iconPath, iconBytes, iconDimensions),
        illustration: provenance(
          "card-illustration",
          mapping.illustration,
          illustrationPath,
          illustrationBytes,
          illustrationDimensions,
        ),
      },
    };
  });

  const manifest = prepared.map((asset) => asset.manifest);
  if (
    new Set(manifest.map((asset) => asset.icon.sha256)).size !== manifest.length ||
    new Set(manifest.map((asset) => asset.illustration.sha256)).size !== manifest.length
  ) {
    throw new Error("AppMedia returned duplicate card-art binaries");
  }
  validateManifestCoverage(cards, manifest);
  await mkdir(artDirectory, { recursive: true });
  await mkdir(illustrationDirectory, { recursive: true });
  await mapWithConcurrency(prepared, 8, async (asset) => {
    await Promise.all([
      writeFile(join(artDirectory, `${asset.manifest.cardId}.webp`), asset.iconBytes),
      writeFile(
        join(illustrationDirectory, `${asset.manifest.cardId}.webp`),
        asset.illustrationBytes,
      ),
    ]);
  });

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
const japaneseCardText = languageMap(japanese["LangCard_Jpn.json"]);
const japaneseCharacterText = languageMap(japanese["LangCharacter_Jpn.json"]);
const talentNameJaById = new Map(
  [...characters].map(([characterId, character]) => [
    characterId,
    japaneseCharacterText.get(character.nameLangId),
  ]),
);
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
    const titleJa = japaneseCardText.get(card.nameLangId);
    const maxLevelRow = levelRows.get(card.cardLevelGroupId)?.at(-1);
    const parameterBase = Number(maxLevelRow?.parameterBaseValue ?? 0);
    const maxPotentialMultiplier = rarity >= 4 ? 1.1 : 1;
    const leader = leaderSkills.get(costume?.liveLeaderSkillId);
    const active = activeLevels.get(card.liveActiveSkillId) ?? [];
    const passive = passiveLevels.get(card.livePassiveSkillId) ?? [];
    const special = specialLevels.get(card.liveSpecialSkillId) ?? [];
    const talentName = character?.nameEng ?? card.characterId;
    // Character.order is the pinned upstream display position; do not derive this from the ID.
    const generationOrder = character?.order;
    if (!Number.isInteger(generationOrder) || generationOrder <= 0) {
      throw new Error(`${card.characterId}: missing pinned Character.order display position`);
    }
    const groups = (character?.regularCharacterGroupingIds ?? [])
      .map((groupId) => characterGroups.get(groupId))
      .map((group) => englishText.get(group?.nameLangId))
      .filter(Boolean);

    return {
      id: card.id,
      firstSeenAt: firstSeenAtFor(card.id),
      slug: slugify(`${talentName}-${title}-${card.id}`),
      talentId: card.characterId,
      generationOrder,
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
    };
  })
  .sort((left, right) => {
    if (left.rarity !== right.rarity) return right.rarity - left.rarity;
    return left.talentName.localeCompare(right.talentName) || left.id.localeCompare(right.id);
  });

let manifest;
if (skipArt) {
  const storedManifest = JSON.parse(await readFile(assetManifestFile, "utf8"));
  manifest = storedManifest.assets;
  validateManifestCoverage(cards, manifest);
  const assetByCardId = new Map(manifest.map((entry) => [entry.cardId, entry]));
  for (const card of cards) {
    const asset = assetByCardId.get(card.id);
    card.artPath = asset?.icon?.localPath ?? null;
    card.illustrationPath = asset?.illustration?.localPath ?? null;
  }
} else {
  manifest = await downloadArt(cards, talentNameJaById);
}

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
  ],
  cards,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
if (!skipArt) {
  await writeFile(
    assetManifestFile,
    `${JSON.stringify({
      schemaVersion: 2,
      retrievedAt,
      source: sources.art,
      expectedCounts: {
        cards: cards.length,
        icons: cards.length,
        illustrations: cards.length,
      },
      assets: manifest,
    }, null, 2)}\n`,
  );
}

const missingArt = manifest.filter((entry) => entry.status !== "downloaded");
console.log(`Normalized ${cards.length} cards (${payload.counts.fiveStar} five-star, ${payload.counts.fourStar} four-star).`);
console.log(`${skipArt ? "Reused" : "Downloaded"} ${payload.counts.art} card-art pairs; ${missingArt.length} unresolved.`);
if (missingArt.length > 0) {
  console.log(`Missing: ${missingArt.map((entry) => entry.cardId).join(", ")}`);
  process.exitCode = 1;
}
