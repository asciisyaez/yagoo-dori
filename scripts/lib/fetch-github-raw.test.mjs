import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fetchGithubRaw } from "./fetch-github-raw.mjs";

test("mirror returns the requested immutable object despite newer HEAD and dirty files", async () => {
  const root = await mkdtemp(join(tmpdir(), "holodori-mirror-test-"));
  const directory = join(root, "eng");
  const previous = process.env.HOLODORI_DB_MIRROR_ROOT;
  const git = (...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
  try {
    await mkdir(directory);
    git("init", "--quiet");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    await writeFile(join(directory, "Card.json"), '["pinned"]');
    git("add", "Card.json"); git("commit", "--quiet", "-m", "pinned");
    const pin = git("rev-parse", "HEAD");
    await writeFile(join(directory, "Card.json"), '["newer"]');
    git("add", "Card.json"); git("commit", "--quiet", "-m", "newer");
    await writeFile(join(directory, "Card.json"), '["dirty"]');
    process.env.HOLODORI_DB_MIRROR_ROOT = root;
    const url = (commit, path = "Card.json") => `https://raw.githubusercontent.com/HolodoriDB/holodori-db-eng-diff/${commit}/${path}`;
    assert.deepEqual(await (await fetchGithubRaw(url(pin))).json(), ["pinned"]);
    await assert.rejects(fetchGithubRaw(url("0".repeat(40))), /cannot supply/);
    await assert.rejects(fetchGithubRaw(url("main")), /immutable commit/);
    await assert.rejects(fetchGithubRaw(url(pin, "../outside.json")), /outside root/);
  } finally {
    if (previous === undefined) delete process.env.HOLODORI_DB_MIRROR_ROOT;
    else process.env.HOLODORI_DB_MIRROR_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
});
