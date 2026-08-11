import { expect, test } from "@playwright/test";

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
    await expect(page.getByText("Model utility").first()).toBeVisible();
    await expect(page.getByText("Relative team value, not a projected Live Score.")).toBeVisible();
    await expect(page.getByText("Average performance across 30 Expert charts", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Displaced from the five Members" })).toBeVisible();
    // Two team columns render: the saved roster and the hypothetical.
    await expect(page.getByText("Saved roster", { exact: true })).toBeVisible();
    await expect(page.getByText("With AZKi", { exact: true })).toBeVisible();
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
  });
});
