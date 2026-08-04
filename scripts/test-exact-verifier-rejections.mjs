import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { readBoundedJson } from "./lib/read-bounded-json.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nativeRoot = join(repoRoot, "data", "native");
const verifierPaths = {
  run: join(repoRoot, "scripts", "verify-exact-shards.mjs"),
  plan: join(repoRoot, "scripts", "verify-exact-shard-plan.mjs"),
};
const artifactNames = {
  run: "exact-optimizer-shard-fixture-v1.json",
  reduced: "exact-optimizer-reduced-shard-run-v1.json",
  plan: "exact-optimizer-full-shard-plan-v1.json",
};

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function updateJson(path, mutate) {
  const value = readJson(path);
  mutate(value);
  writeJson(path, value);
}

function resignRunRecord(record) {
  for (const shard of record.shards) {
    shard.sha256 = sha256(without(shard, "sha256"));
  }
  record.recordHash = sha256(without(record, "recordHash"));
}

function resignPlan(plan) {
  for (const shard of plan.shards) {
    shard.resumeToken = sha256({
      scopeHash: plan.scopeHash,
      shardId: shard.shardId,
      range: shard.range,
      prefix: shard.prefix,
    });
  }
  plan.planHash = sha256(without(plan, "planHash"));
}

function createArtifactCase(name) {
  const root = mkdtempSync(join(tmpdir(), `yagoo-dori-verifier-${name}-`));
  const paths = {};
  for (const [kind, artifactName] of Object.entries(artifactNames)) {
    const path = join(root, artifactName);
    copyFileSync(join(nativeRoot, artifactName), path);
    paths[kind] = path;
  }
  return { root, paths };
}

function runVerifier(kind, artifactPath) {
  const args = kind === "plan"
    ? ["--import", "tsx/esm", verifierPaths.plan, artifactPath]
    : [verifierPaths.run, artifactPath];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

function runMutation(testCase) {
  const { root, paths } = createArtifactCase(testCase.name);
  try {
    testCase.mutate(paths);
    const result = runVerifier(testCase.verifier, testCase.verifier === "plan" ? paths.plan : paths.run);
    if (result.status === 0) {
      throw new Error("verifier accepted the mutation");
    }
    if (!result.output.includes(testCase.expected)) {
      throw new Error(`missing failure line ${JSON.stringify(testCase.expected)}\n${result.output}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runBoundedReaderCase(testCase) {
  const root = mkdtempSync(join(tmpdir(), `yagoo-dori-reader-${testCase.name}-`));
  const path = join(root, `${testCase.name}.json`);
  try {
    testCase.write(path);
    try {
      readBoundedJson(path, testCase.options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(testCase.expected)) {
        throw new Error(`missing reader failure line ${JSON.stringify(testCase.expected)}: ${message}`);
      }
      return;
    }
    throw new Error("bounded reader accepted the mutation");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const mutationCases = [
  {
    name: "scope-hash",
    verifier: "run",
    expected: "scopeHash does not match the checked-in scope manifest",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.scopeHash = "f".repeat(64);
      record.shards.forEach((shard) => { shard.scopeHash = record.scopeHash; });
      resignRunRecord(record);
    }),
  },
  {
    name: "kernel-hash",
    verifier: "run",
    expected: "kernelHash does not match the checked-in kernel bytes",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.kernelHash = "e".repeat(64);
      record.shards.forEach((shard) => { shard.kernelHash = record.kernelHash; });
      resignRunRecord(record);
    }),
  },
  {
    name: "shard-sha256",
    verifier: "run",
    expected: "shards[0]: sha256 mismatch",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.shards[0].sha256 = "0".repeat(64);
    }),
  },
  {
    name: "record-hash",
    verifier: "run",
    expected: "recordHash mismatch",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.recordHash = "0".repeat(64);
    }),
  },
  {
    name: "plan-hash",
    verifier: "plan",
    expected: "planHash mismatch",
    mutate: ({ plan }) => updateJson(plan, (shardPlan) => {
      shardPlan.planHash = "0".repeat(64);
    }),
  },
  {
    name: "overlapping-shard-ranges",
    verifier: "run",
    expected: "shards[1]: non-contiguous range; expected start",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.shards[1].range.startInclusive = record.shards[0].range.startInclusive;
      resignRunRecord(record);
    }),
  },
  {
    name: "exact-plus-pruned-reconciliation",
    verifier: "run",
    expected: "shards[0]: exactLeaves + prunedTeamSets does not reconcile",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.shards[0].exactLeaves += 1;
      resignRunRecord(record);
    }),
  },
  {
    name: "certificate-eligible-plan",
    verifier: "plan",
    expected: "a shard plan must never be certificate eligible",
    mutate: ({ plan }) => updateJson(plan, (shardPlan) => {
      shardPlan.certificateEligible = true;
      resignPlan(shardPlan);
    }),
  },
  {
    name: "non-hex-hash",
    verifier: "run",
    expected: "invalid scopeHash",
    mutate: ({ run }) => updateJson(run, (record) => {
      record.scopeHash = "not-a-hex-hash";
      record.shards.forEach((shard) => { shard.scopeHash = record.scopeHash; });
      resignRunRecord(record);
    }),
  },
  {
    name: "invalid-json",
    verifier: "run",
    expected: "invalid JSON",
    mutate: ({ run }) => writeFileSync(run, '{"schemaVersion":1', "utf8"),
  },
];

const boundedReaderCases = [
  {
    name: "oversized",
    options: { maxBytes: 32 },
    expected: "byte cap 32 exceeded",
    write: (path) => writeFileSync(path, Buffer.alloc(33, 32)),
  },
  {
    name: "deeply-nested",
    options: { maxDepth: 4 },
    expected: "JSON depth cap 4 exceeded",
    write: (path) => {
      let value = 0;
      for (let index = 0; index < 6; index += 1) value = { nested: value };
      writeJson(path, value);
    },
  },
  {
    name: "forbidden-proto-key",
    options: {},
    expected: 'forbidden own key "__proto__"',
    write: (path) => writeFileSync(path, '{"nested":{"__proto__":{}}}', "utf8"),
  },
  {
    name: "forbidden-constructor-key",
    options: {},
    expected: 'forbidden own key "constructor"',
    write: (path) => writeFileSync(path, '{"nested":{"constructor":{}}}', "utf8"),
  },
];

const verifierFailures = [];
for (const testCase of mutationCases) {
  try {
    runMutation(testCase);
  } catch (error) {
    verifierFailures.push(`${testCase.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const readerFailures = [];
for (const testCase of boundedReaderCases) {
  try {
    runBoundedReaderCase(testCase);
  } catch (error) {
    readerFailures.push(`${testCase.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const failures = [...verifierFailures, ...readerFailures];
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  console.error(`FAIL verifier rejection runner: ${mutationCases.length - verifierFailures.length}/${mutationCases.length} verifier mutations and ${boundedReaderCases.length - readerFailures.length}/${boundedReaderCases.length} bounded-reader cases passed`);
  process.exitCode = 1;
} else {
  console.log(`PASS verifier rejection runner: ${mutationCases.length}/${mutationCases.length} verifier mutations rejected; ${boundedReaderCases.length}/${boundedReaderCases.length} bounded-reader cases rejected; originals untouched`);
}
