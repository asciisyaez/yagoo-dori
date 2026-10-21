#!/usr/bin/env node
/**
 * i18n completeness checker
 *
 * Verifies that every key present in `en.json` also exists in every
 * other locale JSON file under `apps/web/src/locales/`.
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *   pnpm i18n:check
 *
 * Exit codes:
 *   0 — all locales are complete
 *   1 — one or more locales have missing keys
 *
 * Ignores:
 *   - The `_meta` key (contributor metadata, not a UI string)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const LOCALES_DIR = resolve(__dirname, "../apps/web/src/locales");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all dot-notation leaf paths from an object. */
function collectKeys(obj, prefix = "") {
  /** @type {string[]} */
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_meta") continue; // reserved metadata key
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Resolve a dot-notation path in an object. Returns undefined if missing. */
function getPath(obj, path) {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.error("❌  No locale files found in", LOCALES_DIR);
  process.exit(1);
}

const enPath = join(LOCALES_DIR, "en.json");
const enData = JSON.parse(readFileSync(enPath, "utf-8"));
const enKeys = collectKeys(enData);

console.log(`\ni18n completeness check`);
console.log(`  Source of Truth : en.json (${enKeys.length} keys)`);
console.log(`  Locale files    : ${files.join(", ")}\n`);

let overallPass = true;

for (const file of files) {
  if (file === "en.json") continue;

  const locale = file.replace(".json", "");
  const data = JSON.parse(readFileSync(join(LOCALES_DIR, file), "utf-8"));
  const missing = enKeys.filter((key) => getPath(data, key) === undefined);

  if (missing.length === 0) {
    console.log(`  ✅  ${locale} — all ${enKeys.length} keys present`);
  } else {
    overallPass = false;
    console.log(`  ❌  ${locale} — ${missing.length} missing key(s):`);
    for (const key of missing) {
      console.log(`       - ${key}`);
    }
  }
}

console.log();

if (!overallPass) {
  console.error("i18n check FAILED — add missing keys before merging.\n");
  process.exit(1);
} else {
  console.log("i18n check passed.\n");
}
