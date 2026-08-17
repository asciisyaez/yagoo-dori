import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildExactOptimizerCoverageLedger,
  validateExactOptimizerCoverageLedger,
  type ExactOptimizerCoverageLedger,
} from "./exact-optimizer-coverage";
import { exactOptimizerScope } from "./exact-optimizer-scope";

const NATIVE_DATA_ROOT = fileURLToPath(new URL("../../../data/native/", import.meta.url));
const COVERAGE_ARTIFACTS = [
  "exact-optimizer-compiled-parity-v1.json",
  "exact-optimizer-leader-root-bounds-v1.json",
] as const;

type JsonObject = Record<string, unknown>;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as JsonObject;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function resignArtifact(artifact: JsonObject): void {
  const { reportHash: _reportHash, ...withoutHash } = artifact;
  artifact.reportHash = sha256(withoutHash);
}

async function buildWithArtifactMutation(
  artifactName: (typeof COVERAGE_ARTIFACTS)[number],
  mutate: (artifact: JsonObject) => void,
  resign: boolean,
): Promise<ExactOptimizerCoverageLedger> {
  const artifactRoot = await mkdtemp(join(tmpdir(), "yagoo-dori-coverage-"));
  try {
    await Promise.all(
      COVERAGE_ARTIFACTS.map((name) =>
        copyFile(join(NATIVE_DATA_ROOT, name), join(artifactRoot, name)),
      ),
    );
    // The recorded research artifacts are pinned to the pre-patch scope, so
    // every reader would stop at the scope-stale guard before reaching the
    // guard each test targets. Normalize both fixture copies to the CURRENT
    // scope hash first (temp-dir scaffolding only; the real artifacts are
    // never touched) so each specific mutation exercises its own guard.
    await Promise.all(
      COVERAGE_ARTIFACTS.map(async (name) => {
        const path = join(artifactRoot, name);
        const copy = JSON.parse(await readFile(path, "utf8")) as JsonObject;
        copy.scopeHash = exactOptimizerScope.scopeHash;
        resignArtifact(copy);
        await writeFile(path, `${JSON.stringify(copy, null, 2)}\n`, "utf8");
      }),
    );
    const artifactPath = join(artifactRoot, artifactName);
    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as JsonObject;
    mutate(artifact);
    if (resign) resignArtifact(artifact);
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    return await buildExactOptimizerCoverageLedger({ artifactRoot });
  } finally {
    await rm(artifactRoot, { recursive: true, force: true });
  }
}

describe("exact optimizer coverage ledger", () => {
  it("reports the recorded research evidence as honestly stale against the patched scope", async () => {
    // The 2026-08 roster patch (115 -> 120 cards) minted a new scope hash.
    // The recorded trace-parity and root-bound artifacts are pinned to the
    // previous scope; until they are regenerated, the ledger must refuse
    // authorization with the specific scope-stale reasons rather than carry
    // pre-patch coverage forward. Structural per-card axes still enumerate
    // the current 120-card roster.
    const ledger = await buildExactOptimizerCoverageLedger();
    expect(() => validateExactOptimizerCoverageLedger(ledger)).toThrow(
      /authorization gate is not satisfied/i,
    );

    expect(ledger.requiredZeroCoverage).toEqual([]);
    expect(ledger.coverage.find((axis) => axis.id === "member-cards")!.entries).toHaveLength(120);
    expect(ledger.coverage.find((axis) => axis.id === "leader-sources")!.entries).toHaveLength(120);
    expect(ledger.coverage.find((axis) => axis.id === "application-records")!.entries.length).toBeGreaterThan(0);
    expect(ledger.gates.compression).toMatchObject({
      authorized: false,
      reason: "The full trace parity artifact scope hash is stale.",
    });
    expect(ledger.gates.rootBounds).toMatchObject({
      authorized: false,
      reason: "The full fixed-Leader root-bound artifact scope hash is stale.",
    });
    expect(ledger.gates.coverageAuthorization.authorized).toBe(false);
  }, 30_000);

  it("rejects a stale trace-parity report hash without granting coverage", async () => {
    const ledger = await buildWithArtifactMutation(
      "exact-optimizer-compiled-parity-v1.json",
      (artifact) => {
        artifact.reportHash = "0".repeat(64);
      },
      false,
    );

    expect(ledger.gates.compression.authorized).toBe(false);
    expect(ledger.gates.coverageAuthorization.authorized).toBe(false);
    expect(ledger.gates.compression.reason).toBe(
      "The full trace parity artifact report hash is stale.",
    );
  }, 120_000);

  it("rejects a re-signed root-bound scope mismatch without granting coverage", async () => {
    const ledger = await buildWithArtifactMutation(
      "exact-optimizer-leader-root-bounds-v1.json",
      (artifact) => {
        artifact.scopeHash = "1".repeat(64);
      },
      true,
    );

    expect(ledger.gates.rootBounds.authorized).toBe(false);
    expect(ledger.gates.coverageAuthorization.authorized).toBe(false);
    expect(ledger.gates.rootBounds.reason).toBe(
      "The full fixed-Leader root-bound artifact scope hash is stale.",
    );
  }, 120_000);

  it("rejects a re-signed short trace-parity sample count without granting coverage", async () => {
    const ledger = await buildWithArtifactMutation(
      "exact-optimizer-compiled-parity-v1.json",
      (artifact) => {
        artifact.sampleCount = 99_999;
      },
      true,
    );

    expect(ledger.gates.compression.authorized).toBe(false);
    expect(ledger.gates.coverageAuthorization.authorized).toBe(false);
    expect(ledger.gates.compression.reason).toBe(
      "The full trace parity artifact sample count is stale.",
    );
  }, 120_000);

  it("rejects a re-signed root-bound certificate eligibility flip without granting coverage", async () => {
    const ledger = await buildWithArtifactMutation(
      "exact-optimizer-leader-root-bounds-v1.json",
      (artifact) => {
        artifact.certificateEligible = true;
      },
      true,
    );

    expect(ledger.gates.rootBounds.authorized).toBe(false);
    expect(ledger.gates.coverageAuthorization.authorized).toBe(false);
    expect(ledger.gates.rootBounds.reason).toBe(
      "The full fixed-Leader root-bound artifact certificate eligibility is not false.",
    );
  }, 120_000);
});
