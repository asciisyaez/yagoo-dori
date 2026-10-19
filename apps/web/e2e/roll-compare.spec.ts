import { expect, test } from "@playwright/test";
import publicData from "../../../data/generated/holodori-public.json";

const GOTO_OPTIONS = { waitUntil: "domcontentloaded" as const };
const MAIN_KEY = "yagoo-dori:team-calculator-roster";

// Six 4★ commons across six distinct talents — a deliberately weak roster.
const WEAK_ROSTER = [
  "card-00004-4-cmmn-0000-00",
  "card-00023-4-cmmn-0000-00",
  "card-00035-4-cmmn-0000-00",
  "card-03001-4-cmmn-0000-00",
  "card-03002-4-cmmn-0000-00",
  "card-04001-4-cmmn-0000-00",
];
const STRONG_PICK = "card-00013-5-uniq-0002-00"; // AZKi 5★, seventh talent

// Six 5★ across six distinct talents — a roster a 4★ common cannot improve.
const STRONG_ROSTER = [
  "card-00002-5-uniq-0001-00",
  "card-00005-5-uniq-0006-00",
  "card-00006-5-uniq-0007-00",
  "card-00010-5-uniq-0010-00",
  "card-00011-5-uniq-0011-00",
  "card-00013-5-uniq-0002-00",
];
const WEAK_PICK = "card-00004-4-cmmn-0000-00";

function seedScript(cardIds: readonly string[]): string {
  const record = JSON.stringify({
    version: 4,
    rosterCommit: "0".repeat(40),
    cards: Object.fromEntries(cardIds.map((cardId) => [cardId, 0])),
    oshi: { enabled: false, talentId: null, role: "member" },
    requiredMemberCardIds: [],
    playerLevel: null,
    boards: {},
  });
  return `
    if (!window.localStorage.getItem("__e2e-roll-seeded")) {
      window.localStorage.clear();
      window.localStorage.setItem(${JSON.stringify(MAIN_KEY)}, ${JSON.stringify(record)});
      window.localStorage.setItem("__e2e-roll-seeded", "1");
    }
  `;
}

test.describe("roll compare", () => {
  test.skip(({ isMobile }) => isMobile, "One comparison drill per flow is sufficient");

  test("without a saved roster the tool explains itself and links to the team calculator", async ({ page }) => {
    await page.goto("/roll-compare", GOTO_OPTIONS);
    await expect(page.getByRole("heading", { level: 1, name: "Should you roll?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add more cards to compare a roll" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Build your saved roster/ })).toBeVisible();
  });

  test("new Seaside Days cards are selectable from an existing saved roster", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(seedScript(WEAK_ROSTER));
    for (const [cardId, talent, title] of [
      ["card-00027-5-uniq-0092-00", "Tokoyami Towa", "Shady Hammock Days"],
      ["card-03008-5-uniq-0095-00", "Kaela Kovalskia", "Shady Shiny Memory"],
      ["card-00032-5-uniq-0093-00", "Shishiro Botan", "Slurping Frenzy"],
      ["card-04014-5-uniq-0094-00", "Koseki Bijou", "Beaming Sandcastle"],
    ]) {
      await page.goto(`/roll-compare?card=${cardId}`, GOTO_OPTIONS);
      await expect(page.getByRole("heading", { level: 3, name: talent })).toBeVisible();
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Compare teams" })).toBeEnabled();
    }
    await page.getByRole("button", { name: "Compare teams" }).click();
    await expect(page.getByText("Koseki Bijou joins your strongest found team")).toBeVisible({ timeout: 120_000 });
  });

  test("every unowned catalog card appears in the picker and pending comparisons", async ({ page }) => {
    test.setTimeout(180_000);
    const owned = [...WEAK_ROSTER, "card-00027-5-uniq-0022-00", "card-04014-5-uniq-0053-00"];
    await page.addInitScript(seedScript(owned));
    await page.goto("/roll-compare", GOTO_OPTIONS);
    const expectedIds = publicData.cards.filter((card) => !owned.includes(card.id)).map((card) => card.id).sort();
    await expect(page.locator("[data-picker-card-id]")).toHaveCount(expectedIds.length);
    expect((await page.locator("[data-picker-card-id]").evaluateAll((elements) => elements.map((el) => el.getAttribute("data-picker-card-id")))).sort()).toEqual(expectedIds);
    expect((await page.locator("[data-pending-card-id]").evaluateAll((elements) => elements.map((el) => el.getAttribute("data-pending-card-id")))).sort()).toEqual(expectedIds);
    const search = page.getByRole("searchbox", { name: "Search unowned cards" });
    await search.fill("Koseki Bijou");
    await expect(page.locator("[data-pending-card-id]")).toHaveCount(2);
    await expect(page.getByText("2 unowned cards match", { exact: false })).toBeVisible();
    await search.fill("Tokoyami Towa");
    await expect(page.locator('[data-pending-card-id="card-00027-5-uniq-0092-00"]')).toBeVisible();
    await page.locator('[data-pending-card-id="card-00027-5-uniq-0092-00"]').click();
    await expect(page.locator('[data-pending-card-id="card-00027-5-uniq-0092-00"]')).toBeDisabled();
    await expect(page.locator('[data-comparison-card-id="card-00027-5-uniq-0092-00"]')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[data-pending-card-id="card-00027-5-uniq-0092-00"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Clear card search" }).click();
    await expect(page.locator("[data-picker-card-id]")).toHaveCount(expectedIds.length);
  });

  test("a strong unowned card improves a weak roster: deep link, cancel, rerun, verdict", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(seedScript(WEAK_ROSTER));
    await page.goto(`/roll-compare?card=${STRONG_PICK}`, GOTO_OPTIONS);

    // The deep-linked card is preselected with its provisional-tier context.
    await expect(page.getByRole("heading", { level: 3, name: "AZKi" })).toBeVisible();
    await expect(page.getByText(/Provisional model tier/).first()).toBeVisible();
    await expect(page.getByText("Model tiers, published as provisional theorycraft", { exact: false })).toBeVisible();

    // Cancel mid-run returns to idle without a result.
    const compare = page.getByRole("button", { name: "Compare teams" });
    await compare.click();
    const cancel = page.getByRole("button", { name: "Cancel comparison" });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(page.getByRole("button", { name: "Compare teams" })).toBeVisible();
    await expect(page.getByText("Verdict")).toHaveCount(0);

    // Full run: the 5★ joins and strengthens the weak roster.
    await page.getByRole("button", { name: "Compare teams" }).click();
    await expect(page.getByText("AZKi joins your strongest found team")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("region", { name: "Verdict", exact: true }).getByText("Model utility").first()).toBeVisible();
    await expect(page.getByText("Relative team value, not a projected Live Score.")).toBeVisible();
    await expect(page.getByText("Average performance across 30 Expert charts", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Displaced from the five Members" })).toBeVisible();
    // Two team columns render: the saved roster and the hypothetical.
    await expect(page.getByText("Saved roster", { exact: true })).toBeVisible();
    await expect(page.getByText("With AZKi", { exact: true })).toBeVisible();
  });

  test("batch comparisons stream ranked targets and can pause and resume", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(seedScript(WEAK_ROSTER));
    await page.goto("/roll-compare", GOTO_OPTIONS);
    await page.getByRole("button", { name: "Compare all unowned cards" }).click();
    await expect(page.getByRole("button", { name: "Pause comparisons" })).toBeVisible();
    const targets = page.locator('button').filter({ hasText: /(?:Upgrade found|No upgrade found)/ });
    await expect(targets.first()).toBeVisible({ timeout: 120_000 });
    await page.getByRole("button", { name: "Pause comparisons" }).click();
    const count = await targets.count();
    await expect(page.getByRole("button", { name: "Resume comparisons" })).toBeVisible();
    await expect(targets).toHaveCount(count);
    await page.getByRole("button", { name: "Resume comparisons" }).click();
    await expect(page.getByRole("button", { name: "Pause comparisons" })).toBeVisible();
    await page.getByRole("button", { name: "Pause comparisons" }).click();
    await targets.first().click();
    await expect(page.getByText("Verdict", { exact: true })).toBeVisible();
    await expect(page.getByText("Saved roster", { exact: true })).toBeVisible();
  });

  test("saved Member locks are visible and can be ignored without editing the roster", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(seedScript(WEAK_ROSTER));
    await page.addInitScript((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const roster = JSON.parse(raw);
      roster.requiredMemberCardIds = Object.keys(roster.cards).slice(0, 5);
      localStorage.setItem(key, JSON.stringify(roster));
    }, MAIN_KEY);
    await page.goto(`/roll-compare?card=${STRONG_PICK}`, GOTO_OPTIONS);
    await expect(page.getByText("All five Members are locked.", { exact: false })).toBeVisible();
    const before = await page.evaluate((key) => localStorage.getItem(key), MAIN_KEY);
    await page.getByRole("checkbox", { name: "Respect saved Oshi and Member locks" }).uncheck();
    await expect(page.getByText("All Member slots open; saved Oshi restriction ignored.")).toBeVisible();
    await page.getByRole("button", { name: "Compare teams", exact: true }).click();
    await expect(page.getByText("AZKi joins your strongest found team")).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('a[data-picked="true"]')).toHaveCount(1);
    expect(await page.evaluate((key) => localStorage.getItem(key), MAIN_KEY)).toBe(before);
  });

  test("Pekora Leader restriction explains a fresh-card loss and can be relaxed for an upgrade", async ({ page }) => {
    test.setTimeout(180_000);
    const cards = {
      "card-06004-5-uniq-0060-00": 0,
      "card-04001-5-uniq-0042-00": 1,
      "card-03002-5-uniq-0034-00": 0,
      "card-00012-5-uniq-0012-00": 1,
      "card-00032-5-uniq-0026-00": 0,
      "card-00030-5-uniq-0024-00": 1,
      "card-00027-5-uniq-0022-00": 0,
      "card-00019-5-uniq-0016-00": 1,
      "card-06003-5-uniq-0059-00": 1,
      "card-00006-5-uniq-0007-00": 0,
      "card-00018-4-cmmn-0000-00": 0,
      "card-00015-4-cmmn-0000-00": 0,
      "card-00010-4-cmmn-0000-00": 0,
      "card-00006-4-cmmn-0000-00": 0,
      "card-00011-4-cmmn-0000-00": 1,
      "card-00026-4-cmmn-0000-00": 0,
      "card-00035-4-cmmn-0000-00": 0,
      "card-00036-4-cmmn-0000-00": 0,
      "card-00039-4-cmmn-0000-00": 0,
      "card-03004-4-cmmn-0000-00": 2,
      "card-03008-4-cmmn-0000-00": 1,
      "card-04015-4-cmmn-0000-00": 1,
      "card-04017-4-cmmn-0000-00": 0,
      "card-06005-4-cmmn-0000-00": 0,
      "card-03009-5-uniq-0041-00": 1,
      "card-06005-5-uniq-0061-00": 0,
      "card-04012-5-uniq-0051-00": 0
};
    await page.addInitScript(({ key, cards }) => {
      localStorage.setItem(key, JSON.stringify({
        version: 4, rosterCommit: "0".repeat(40), cards,
        oshi: { enabled: true, talentId: "chr-00019", role: "leader" },
        requiredMemberCardIds: [], playerLevel: null, boards: {},
      }));
    }, { key: MAIN_KEY, cards });
    await page.goto(`/roll-compare?card=${STRONG_PICK}`, GOTO_OPTIONS);
    await expect(page.getByText("Oshi: Usada Pekora (Leader Outfit)", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Compare teams", exact: true }).click();
    await expect(page.getByText("Required Member comparison · signed swap difference")).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[class*="verdict"] > b')).toContainText("−");
    await page.getByRole("checkbox", { name: "Respect saved Oshi and Member locks" }).uncheck();
    await page.getByRole("button", { name: "Compare teams", exact: true }).click();
    await expect(page.getByText("AZKi joins your strongest found team")).toBeVisible({ timeout: 120_000 });
  });

  test("card profiles offer the comparison only for unowned cards with a saved roster", async ({ page }) => {
    // Without a roster: no CTA on any card page.
    await page.goto("/cards/azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00", GOTO_OPTIONS);
    await expect(page.getByRole("heading", { level: 1, name: "AZKi" })).toBeVisible();
    await expect(page.getByRole("link", { name: /strengthens your saved team/ })).toHaveCount(0);

    // With a roster: unowned card gets the CTA and it deep-links correctly.
    await page.addInitScript(seedScript(WEAK_ROSTER));
    await page.goto("/cards/azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00", GOTO_OPTIONS);
    const cta = page.getByRole("link", { name: /strengthens your saved team/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /\/roll-compare\?card=card-00013-5-uniq-0002-00$/);

    // An owned card must not invite a comparison with itself.
    await page.goto("/cards/aki-rosenthal-curious-elf-melody-card-00004-4-cmmn-0000-00", GOTO_OPTIONS);
    await expect(page.getByRole("heading", { level: 1, name: "Aki Rosenthal" })).toBeVisible();
    await expect(page.getByRole("link", { name: /strengthens your saved team/ })).toHaveCount(0);
  });

  test("a weak unowned card does not strengthen a strong roster", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(seedScript(STRONG_ROSTER));
    await page.goto(`/roll-compare?card=${WEAK_PICK}`, GOTO_OPTIONS);

    await page.getByRole("button", { name: "Compare teams" }).click();
    await expect(page.getByText(/does not strengthen your team/)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Required Member comparison · signed swap difference")).toBeVisible();
    await expect(page.locator('[class*="verdict"] > b')).toContainText("−");
  });
});

test("upgrade targets fit mobile and keep the saved roster intact", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile layout coverage");
  await page.addInitScript(seedScript(WEAK_ROSTER));
  await page.goto("/roll-compare?q=AZKi", GOTO_OPTIONS);
  await expect(page.getByRole("heading", { name: "Find your next team upgrade" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search unowned cards" })).toHaveValue("AZKi");
  const before = await page.evaluate((key) => localStorage.getItem(key), MAIN_KEY);
  await page.getByRole("button", { name: "Compare all unowned cards" }).click();
  await page.getByRole("button", { name: "Pause comparisons" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), MAIN_KEY)).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
