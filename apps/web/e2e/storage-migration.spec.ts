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

test.describe("roster storage migration safety", () => {
  test.skip(({ isMobile }) => isMobile, "Storage semantics are viewport-independent");

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
