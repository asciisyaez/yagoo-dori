import { expect, type Page, test } from "@playwright/test";

const GOTO_OPTIONS = { waitUntil: "domcontentloaded" as const };
const TEAM_TALENTS = ["AZKi", "Akai Haato", "Aki Rosenthal", "Anya Melfissa", "Ayunda Risu"];

async function cardIdForTalent(page: Page, talentName: string): Promise<string> {
  return page.locator(".hb-manual-grid select").first().locator("option").evaluateAll((options, name) => {
    const option = options.find((candidate) => candidate.textContent?.startsWith(`${name} ·`));
    if (!(option instanceof HTMLOptionElement)) throw new Error(`Missing planner card for ${name}`);
    return option.value;
  }, talentName);
}

test("Holomem Board loads its zero state", async ({ page }) => {
  await page.goto("/holomem-board", GOTO_OPTIONS);

  await expect(page.getByRole("heading", { level: 1, name: "Plan your Board path" })).toBeVisible();
  await expect(page.getByText("Choose a leader and five member talents to open the Board editor.", { exact: true })).toBeVisible();
  await expect(page.getByText("How these suggestions work", { exact: true })).toBeVisible();
});

test("a fixed manual team can mark a node and run Board suggestions", async ({ isMobile, page }) => {
  test.skip(isMobile, "One browser-worker Board run is sufficient");
  test.setTimeout(120_000);
  await page.goto("/holomem-board", GOTO_OPTIONS);
  await expect(page.locator(".hb-manual-grid select").first().locator("option")).toHaveCount(116);

  const cardIds = new Map<string, string>();
  for (const talentName of TEAM_TALENTS) cardIds.set(talentName, await cardIdForTalent(page, talentName));
  const pickers = page.locator(".hb-manual-grid select");
  await pickers.nth(0).selectOption(cardIds.get("AZKi")!);
  await pickers.nth(1).selectOption(cardIds.get("AZKi")!);
  for (const [index, talentName] of TEAM_TALENTS.slice(1).entries()) {
    await pickers.nth(index + 2).selectOption(cardIds.get(talentName)!);
  }

  await expect(page.locator(".hb-board-node[role=checkbox]").first()).toBeVisible();
  await page.locator('.hb-board-node[role="checkbox"][data-group-id="B-001"]').click();
  await expect(page.getByText("Declared cost: 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Run suggestions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A bounded plan for the declared boards", exact: true })).toBeVisible({ timeout: 90_000 });
  for (const chip of ["bounded suggestion", "conditional on this team", "derived adjacency", "envelope stacking"]) {
    await expect(page.locator(".hb-claim-chip", { hasText: chip })).toBeVisible();
  }
});

test("talent pages render the static Holomem Board reference section", async ({ page }) => {
  await page.goto("/talents/azki", GOTO_OPTIONS);

  const board = page.locator("#holomem-board");
  await expect(board).toBeVisible();
  await expect(board.getByRole("heading", { level: 2, name: "AZKi's Board grid" })).toBeVisible();
  await expect(board.getByRole("heading", { level: 3, name: "Four Board connection slots" })).toBeVisible();
  await expect(board.getByRole("heading", { level: 3, name: "Variant groups for AZKi" })).toBeVisible();
  await expect(board.getByText("G-008", { exact: true })).toBeVisible();
  await expect(board.getByText("G-011", { exact: true })).toBeVisible();
  await expect(board.getByText("G-021", { exact: true })).toBeVisible();
  await expect(board.getByText("+50", { exact: false }).first()).toBeVisible();
  await expect(board.locator(".hb-board-controls")).toHaveCount(0);
});
