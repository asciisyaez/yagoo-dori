import { expect, type Page, test } from "@playwright/test";

const GOTO_OPTIONS = { waitUntil: "domcontentloaded" as const };
const MAIN_KEY = "yagoo-dori:team-calculator-roster";
const BACKUP_V4_KEY = `${MAIN_KEY}:backup-v4`;
const REAL_CARD_ID = "card-00013-5-uniq-0002-00"; // AZKi 5★
const REAL_TALENT_ID = "chr-00013"; // AZKi

// A stale-but-readable v4 record: one real owned card, one board on a real
// talent carrying an unknown node and an unknown Connect placement card, and
// one board on a talent id that no longer exists. Loading it must prune one
// talent, one node, and one placement.
const STALE_RECORD = JSON.stringify({
  version: 4,
  rosterCommit: "0".repeat(40),
  cards: { [REAL_CARD_ID]: 3 },
  oshi: { enabled: false, talentId: null, role: "member" },
  requiredMemberCardIds: [],
  playerLevel: 12,
  boards: {
    [REAL_TALENT_ID]: {
      rank: 10,
      pointMode: "estimate-from-rank",
      extraPoints: 0,
      directPoints: null,
      unlockedNodeGroupIds: ["S-001", "NOT-A-NODE"],
      connectPlacements: { "S-001": "card-gone" },
    },
    "talent-gone": {
      rank: 4,
      pointMode: "estimate-from-rank",
      extraPoints: 0,
      directPoints: null,
      unlockedNodeGroupIds: [],
      connectPlacements: {},
    },
  },
});

function seedScript(record: string): string {
  // Init scripts re-run on every navigation; the marker keeps the seed from
  // resetting state that the test mutated (dismissals, restores) on reload.
  return `
    if (!window.localStorage.getItem("__e2e-roster-seeded")) {
      window.localStorage.clear();
      window.localStorage.setItem(${JSON.stringify(MAIN_KEY)}, ${JSON.stringify(record)});
      window.localStorage.setItem("__e2e-roster-seeded", "1");
    }
  `;
}

// Makes every write to a backup-family key throw, simulating a quota or
// privacy failure that hits exactly the safety copy.
const BACKUP_WRITE_SABOTAGE = `
  const realSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (typeof key === "string" && key.includes(":backup")) throw new Error("simulated quota failure");
    return realSetItem.call(this, key, value);
  };
`;

async function storageValue(page: Page, key: string): Promise<string | null> {
  return page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
}

test.describe("board storage migration safety", () => {
  test.skip(({ isMobile }) => isMobile, "Storage semantics are viewport-independent");

  test("planner backs up before pruning, reports counts once, and can keep or restore", async ({ page }) => {
    await page.addInitScript(seedScript(STALE_RECORD));
    await page.goto("/holomem-board", GOTO_OPTIONS);

    const notice = page.getByRole("status").filter({ hasText: "Some saved Board data was migrated" });
    await expect(notice).toBeVisible();
    await expect(notice.getByText(/Talents: 1/)).toBeVisible();
    await expect(notice.getByText(/Nodes: 1/)).toBeVisible();
    await expect(notice.getByText(/Connect placements: 1/)).toBeVisible();

    // The raw pre-migration record was copied out before the sanitized write.
    await expect.poll(() => storageValue(page, BACKUP_V4_KEY)).toBe(STALE_RECORD);
    await expect.poll(async () => {
      const record = await storageValue(page, MAIN_KEY);
      return record === null ? null : JSON.stringify(Object.keys(JSON.parse(record).boards ?? {}));
    }).toBe(JSON.stringify([REAL_TALENT_ID]));
    const sanitized = JSON.parse((await storageValue(page, MAIN_KEY))!);
    expect(sanitized.boards[REAL_TALENT_ID].unlockedNodeGroupIds).toEqual(["S-001"]);
    expect(sanitized.boards[REAL_TALENT_ID].connectPlacements).toEqual({});

    // Restore puts the raw record back under the main key and clears the notice.
    await notice.getByRole("button", { name: "Restore backup" }).click();
    await expect(notice).toHaveCount(0);
    expect(await storageValue(page, MAIN_KEY)).toBe(STALE_RECORD);

    // A reload after restore neither loops the notice nor loses the backup.
    await page.reload(GOTO_OPTIONS);
    await expect(page.getByRole("heading", { level: 1, name: "Plan your Board path" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Some saved Board data was migrated" })).toHaveCount(0);
    expect(await storageValue(page, BACKUP_V4_KEY)).toBe(STALE_RECORD);
  });

  test("planner dismissal persists across reloads", async ({ page }) => {
    await page.addInitScript(seedScript(STALE_RECORD));
    await page.goto("/holomem-board", GOTO_OPTIONS);

    const notice = page.getByRole("status").filter({ hasText: "Some saved Board data was migrated" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Keep migrated data" }).click();
    await expect(notice).toHaveCount(0);

    await page.reload(GOTO_OPTIONS);
    await expect(page.getByRole("heading", { level: 1, name: "Plan your Board path" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Some saved Board data was migrated" })).toHaveCount(0);
  });

  test("planner keeps the raw record untouched when the backup write fails, and a retry succeeds", async ({ context, page }) => {
    await page.addInitScript(seedScript(STALE_RECORD));
    await page.addInitScript(BACKUP_WRITE_SABOTAGE);
    await page.goto("/holomem-board", GOTO_OPTIONS);

    const notice = page.getByRole("status").filter({ hasText: "Some saved Board data was migrated" });
    await expect(notice).toBeVisible();
    await expect(notice.getByText(/raw backup could not be confirmed/)).toBeVisible();
    await expect(notice.getByRole("button", { name: "Restore backup" })).toBeDisabled();

    // No destructive rewrite and no backup: the seeded record is the only copy.
    expect(await storageValue(page, MAIN_KEY)).toBe(STALE_RECORD);
    expect(await storageValue(page, BACKUP_V4_KEY)).toBeNull();
    // The planner stays usable in this state.
    await expect(page.getByRole("heading", { level: 1, name: "Plan your Board path" })).toBeVisible();

    // Retry without the failure: a fresh page in the same context shares the
    // origin storage but not the sabotage init script.
    const retryPage = await context.newPage();
    await retryPage.goto("/holomem-board", GOTO_OPTIONS);
    const retryNotice = retryPage.getByRole("status").filter({ hasText: "Some saved Board data was migrated" });
    await expect(retryNotice).toBeVisible();
    await expect(retryNotice.getByRole("button", { name: "Restore backup" })).toBeEnabled();
    await expect.poll(() => storageValue(retryPage, BACKUP_V4_KEY)).toBe(STALE_RECORD);
    await retryPage.close();
  });

  test("calculator backs up before pruning Connect placements and then persists normally", async ({ page }) => {
    await page.addInitScript(seedScript(STALE_RECORD));
    await page.goto("/team-builder", GOTO_OPTIONS);

    await expect(page.getByText("Roster saved on this device")).toBeVisible();
    await expect.poll(() => storageValue(page, BACKUP_V4_KEY)).toBe(STALE_RECORD);
    // The calculator prunes by card validity (the unknown placement card);
    // its rewrite may only happen because the backup was confirmed first.
    await expect.poll(async () => {
      const record = await storageValue(page, MAIN_KEY);
      if (record === null) return null;
      const boards = JSON.parse(record).boards ?? {};
      return boards[REAL_TALENT_ID]?.connectPlacements ?? null;
    }).toEqual({});
  });

  test("calculator drops to session mode and leaves the raw record byte-identical when the backup write fails", async ({ page }) => {
    await page.addInitScript(seedScript(STALE_RECORD));
    await page.addInitScript(BACKUP_WRITE_SABOTAGE);
    await page.goto("/team-builder", GOTO_OPTIONS);

    // Session mode is the user-visible explanation that nothing persists.
    await expect(page.getByText("Roster changes stay on this page")).toBeVisible();
    expect(await storageValue(page, MAIN_KEY)).toBe(STALE_RECORD);
    expect(await storageValue(page, BACKUP_V4_KEY)).toBeNull();

    // Interacting must not trigger a write either: toggle a card and re-check.
    const anyCardToggle = page.locator("input[type=checkbox]").first();
    if (await anyCardToggle.count() > 0) await anyCardToggle.click().catch(() => {});
    expect(await storageValue(page, MAIN_KEY)).toBe(STALE_RECORD);
  });
});

test.describe("worker startup failure recovery", () => {
  test.skip(({ isMobile }) => isMobile, "One browser-worker failure drill is sufficient");

  test("a failed Board worker start clears the busy state, explains itself, and a retry succeeds", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(`
      const RealWorker = window.Worker;
      let boardWorkerFailures = 1;
      window.Worker = class extends RealWorker {
        constructor(url, options) {
          if (options && options.name === "yagoo-dori-holomem-board" && boardWorkerFailures > 0) {
            boardWorkerFailures -= 1;
            throw new Error("simulated startup failure");
          }
          super(url, options);
        }
      };
    `);
    await page.goto("/holomem-board", GOTO_OPTIONS);
    await expect(page.locator(".hb-manual-grid select").first().locator("option")).toHaveCount(116);

    // Build the same fixed manual team the planner e2e uses.
    const talentNames = ["AZKi", "Akai Haato", "Aki Rosenthal", "Anya Melfissa", "Ayunda Risu"];
    const cardIds = new Map<string, string>();
    for (const talentName of talentNames) {
      const value = await page.locator(".hb-manual-grid select").first().locator("option").evaluateAll((options, name) => {
        const option = options.find((candidate) => candidate.textContent?.startsWith(`${name} ·`));
        if (!(option instanceof HTMLOptionElement)) throw new Error(`Missing planner card for ${name}`);
        return option.value;
      }, talentName);
      cardIds.set(talentName, value);
    }
    const pickers = page.locator(".hb-manual-grid select");
    await pickers.nth(0).selectOption(cardIds.get("AZKi")!);
    await pickers.nth(1).selectOption(cardIds.get("AZKi")!);
    for (const [index, talentName] of talentNames.slice(1).entries()) {
      await pickers.nth(index + 2).selectOption(cardIds.get(talentName)!);
    }

    const runButton = page.getByRole("button", { name: "Run suggestions", exact: true });
    await runButton.click();
    // The sabotaged first construction rejects: busy state clears and the
    // failure is announced.
    await expect(page.locator(".hb-error[role=alert]")).toBeVisible();
    await expect(runButton).toBeEnabled();

    // Second attempt constructs a real Worker and completes.
    await runButton.click();
    await expect(page.getByRole("heading", { name: "A bounded plan for the declared boards", exact: true })).toBeVisible({ timeout: 90_000 });
  });
});
