import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const command = [
  "cargo",
  "test",
  "--manifest-path",
  "tools/exact-global-solver/Cargo.toml",
  "--",
  "--nocapture",
];
const result = spawnSync(command[0], command.slice(1), {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-rust-mechanic-fixtures-v1",
  command: command.join(" "),
  status: result.status,
  signal: result.signal,
  fixtureFamilies: [
    "combo-at-least pass/fail",
    "deck-attribute-count pass/fail",
    "deck-character-group-count pass/fail",
    "life-at-least pass/fail",
    "all/self/attribute/character-group targets",
    "capped recipient enumeration",
    "base and conditional-override Active combinations",
    "JavaScript-compatible signed micro-unit rounding",
  ],
  stdoutSha256: createHash("sha256").update(result.stdout ?? "", "utf8").digest("hex"),
  stderr: result.stderr?.trim() ?? "",
  parityEligible: result.status === 0,
  certificateEligible: false,
  disposition: result.status === 0
    ? "Compiled prototype mechanic fixtures pass; this validates prototype semantics only and does not promote the prototype to production or certify a roster result."
    : "Compiled prototype mechanic fixtures failed; certificate eligibility remains false.",
};
writeFileSync(join(root, "data/native/exact-optimizer-rust-mechanic-fixtures-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (result.status !== 0) process.exitCode = 1;
