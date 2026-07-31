import { publicData, publicCards } from "../public-data";

const sampleIds = [
  "card-00013-5-uniq-0002-00",
  "card-00012-5-uniq-0062-00",
  "card-06003-4-cmmn-0000-00",
];

for (const id of sampleIds) {
  if (!publicCards.some((card) => card.id === id)) {
    throw new Error(`Pinned representative card is missing: ${id}`);
  }
}

const azki = publicCards.find((card) => card.id === "card-00013-5-uniq-0002-00");
if (
  !azki ||
  azki.attribute !== "pure" ||
  azki.parameters.maxPotential.performance !== 6803 ||
  azki.parameters.maxPotential.technique !== 7682 ||
  azki.parameters.maxPotential.sense !== 11380
) {
  throw new Error("AZKi golden record no longer matches the pinned data and AppMedia corroboration.");
}

if (publicCards.some((card) => /research slot|illustrative/i.test(`${card.title} ${card.talentName}`))) {
  throw new Error("Synthetic research fixtures are not allowed in the public dataset.");
}

console.log(
  `Public dataset valid: ${publicData.counts.talents} talents, ` +
    `${publicData.counts.fiveStar} five-star cards, ${publicData.counts.fourStar} four-star cards, ` +
    `${publicData.counts.art} local art mappings.`,
);
console.log(`Pinned ENG ${publicData.sourceSnapshots.english.commit}; JPN ${publicData.sourceSnapshots.japanese.commit}.`);
