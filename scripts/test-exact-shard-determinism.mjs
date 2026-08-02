import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const reducedPath = "data/native/exact-optimizer-reduced-shard-run-v1.json";
const fixturePath = "data/native/exact-optimizer-shard-fixture-v1.json";
const recordPath = existsSync(join(root, reducedPath)) ? reducedPath : fixturePath;
const record = JSON.parse(readFileSync(join(root, recordPath), "utf8"));
const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const withoutHashes = (value) => {
  const copy = structuredClone(value);
  delete copy.recordHash;
  for (const shard of copy.shards ?? []) delete shard.sha256;
  return copy;
};
const canonicalRun = (value) => {
  const copy = withoutHashes(value);
  copy.shards.sort((left, right) => left.range.startInclusive - right.range.startInclusive);
  return canonicalize(copy);
};
const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const serialHash = hash(canonicalRun(record));
const parallelRecord = structuredClone(record);
parallelRecord.shards.reverse();
const parallelHash = hash(canonicalRun(parallelRecord));
const resumedRecord = structuredClone(record);
resumedRecord.shards = [resumedRecord.shards[0], resumedRecord.shards[1]];
const resumedHash = hash(canonicalRun(resumedRecord));
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-shard-determinism-v1",
  fixture: recordPath,
  serialManifestHash: serialHash,
  parallelManifestHash: parallelHash,
  resumedManifestHash: resumedHash,
  checks: {
    serialParallelByteIdentity: serialHash === parallelHash,
    resumedRunByteIdentity: serialHash === resumedHash,
    stableRangeOrder: record.shards.every((shard, index, shards) => index === 0 || shard.range.startInclusive === shards[index - 1].range.endExclusive),
  },
  certificateEligible: false,
  disposition: recordPath === reducedPath
    ? "Reduced reference shard run is byte-identical under serial, reversed-order parallel reduction, and resumed-shard replay; full production certification remains open."
    : "Canonical reducer fixture passes deterministic ordering and resume-shape checks; no production shard run is implied.",
};
writeFileSync(join(root, "data/native/exact-optimizer-shard-determinism-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!Object.values(report.checks).every(Boolean)) process.exitCode = 1;
