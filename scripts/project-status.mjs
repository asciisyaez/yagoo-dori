import { readFileSync, readdirSync } from "node:fs";

const v1Root = new URL("../.codex/epics/yagoo-dori-v1/", import.meta.url);
const v2Root = new URL("../.codex/epics/yagoo-dori-v0.2-exact/", import.meta.url);
const status = JSON.parse(readFileSync(new URL("status.json", v1Root), "utf8"));
const exactStatus = JSON.parse(readFileSync(new URL("status.json", v2Root), "utf8"));

function readEpicRows(epicRoot, epicStatus) {
  const ticketDirectory = new URL("tickets/", epicRoot);
  const ticketFiles = readdirSync(ticketDirectory)
    .filter((name) => name.endsWith(".md"))
    .sort();

  return ticketFiles.map((name) => {
    const content = readFileSync(new URL(`tickets/${name}`, epicRoot), "utf8");
    const id = content.match(/^id:\s*(.+)$/m)?.[1]?.trim() ?? name;
    const state = content.match(/^status:\s*(.+?)(?:\s+#.*)?$/m)?.[1]?.trim() ?? "unknown";
    const checks = [...content.matchAll(/^- \[([ x])\] /gm)];
    const complete = checks.filter((match) => match[1] === "x").length;
    const weight = epicStatus.weights[id] ?? 0;
    const ratio = state === "done" && checks.length > 0 ? complete / checks.length : 0;
    return { id, state, complete, total: checks.length, weight, earned: weight * ratio };
  }).filter((row) => epicStatus.ticketOrder.includes(row.id))
    .sort((left, right) => epicStatus.ticketOrder.indexOf(left.id) - epicStatus.ticketOrder.indexOf(right.id));
}

const rows = readEpicRows(v1Root, status);
const exactRows = readEpicRows(v2Root, exactStatus);
const v1Completion = rows.reduce((sum, row) => sum + row.earned, 0);
const v2Completion = exactRows.reduce((sum, row) => sum + row.earned, 0);
const active = exactRows.find((row) => row.state === "active") ?? exactRows.find((row) => row.state === "blocked");

console.log("Yagoo-dori product and exact-certification status");
console.log(`Core objective: ${status.objective}`);
console.log(`Current milestone: ${active ? `${active.id} (${active.state})` : "No active v0.2 ticket"}`);
console.log(`v0.1 product: ${v1Completion.toFixed(1)}% verified; public release live and guarded for future replacements`);
console.log(`v0.2 exact certification: ${v2Completion.toFixed(1)}% verified; certificate state ${exactStatus.certificateState}`);
console.log(`Overall completion: v0.1 ${v1Completion.toFixed(1)}%; v0.2 ${v2Completion.toFixed(1)}% (not combined)`);
console.log("");

console.log("v0.1 product tickets");
for (const row of rows) {
  console.log(`${row.id.padEnd(3)} ${row.state.padEnd(8)} ${String(row.complete).padStart(2)}/${String(row.total).padEnd(2)} criteria  ${row.earned.toFixed(1)}/${row.weight}%`);
}

console.log("");
console.log("v0.2 exact-certification tickets");
for (const row of exactRows) {
  console.log(`${row.id.padEnd(3)} ${row.state.padEnd(8)} ${String(row.complete).padStart(2)}/${String(row.total).padEnd(2)} criteria  ${row.earned.toFixed(1)}/${row.weight}%`);
}

console.log("");
console.log(`Completed since last report: ${status.completedSinceLastReport.join("; ") || "None recorded"}`);
console.log(`Blockers: v0.1 ${status.blockers.join("; ") || "None"}; v0.2 ${exactStatus.blockers.join("; ") || "None"}`);
console.log(`Next unblocked action: ${exactStatus.nextAction}`);
