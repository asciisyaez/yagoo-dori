import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const sha256File = (relativePath) => createHash("sha256").update(readFileSync(join(root, relativePath))).digest("hex");

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const mechanicsPath = "data/generated/holodori-mechanics.json";
const publicPath = "data/generated/holodori-public.json";
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const mechanics = readJson(mechanicsPath);
const publicData = readJson(publicPath);
const publicById = new Map(publicData.cards.map((card) => [card.id, card]));

const cards = mechanics.cards.map((card) => {
  const identity = publicById.get(card.cardId);
  if (!identity) throw new Error(`Missing public identity for ${card.cardId}`);
  return {
    cardId: card.cardId,
    talentId: card.talentId,
    rarity: card.rarity,
    identity: {
      attribute: identity.attribute,
      generation: identity.generation,
      groups: identity.groups,
    },
    parameterDistributionPermil: card.parameterDistributionPermil,
    progression: card.progression,
    skills: card.skills,
    leaderOutfit: card.leaderOutfit,
    coverage: card.coverage,
    unresolvedRuleIds: card.unresolvedRuleIds,
    scoringEligible: card.scoringEligible,
  };
});

const applicationRows = cards.flatMap((card) => [
  ...card.skills.active,
  ...card.skills.passive,
  ...card.skills.special,
  { applications: card.leaderOutfit.applications },
].flatMap((skill) => skill.applications));
const coverage = {
  effectKinds: [...new Set(applicationRows.map((row) => row.effect?.kind).filter(Boolean))].sort(),
  triggerKinds: [...new Set(applicationRows.map((row) => row.trigger?.kind).filter(Boolean))].sort(),
  targetKinds: [...new Set(applicationRows.map((row) => row.target?.kind).filter(Boolean))].sort(),
  combinationModes: [...new Set(applicationRows.map((row) => row.combination))].sort(),
  channels: [...new Set(applicationRows.map((row) => row.channel))].sort(),
  memberCardCount: cards.length,
  leaderOutfitCardCount: cards.length,
};

const ir = {
  schemaVersion: 1,
  irId: "yd-exact-optimizer-parity-ir-v1",
  methodologyVersion: "yd-compiled-kernel-parity-1.0.0",
  certificateEligible: false,
  scopeHash: scope.scopeHash,
  source: {
    rosterCommit: scope.roster.sourceCommit,
    mechanicsPath,
    mechanicsSha256: sha256File(mechanicsPath),
    publicPath,
    publicSha256: sha256File(publicPath),
    benchmarkId: scope.chartCorpus.benchmarkId,
  },
  roundingBoundary: "native-Math.round(value*1000000)",
  coverage,
  catalogs: mechanics.catalogs,
  cards,
};
const irHash = createHash("sha256").update(canonicalize(ir), "utf8").digest("hex");
const output = { ...ir, irHash };
writeFileSync(join(root, "data/native/exact-optimizer-parity-ir-v1.json"), `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({ outputPath: "data/native/exact-optimizer-parity-ir-v1.json", irHash, ...coverage }, null, 2));
