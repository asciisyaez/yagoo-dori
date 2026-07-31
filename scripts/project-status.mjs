import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../.codex/epics/yagoo-dori-v1/", import.meta.url);
const status = JSON.parse(readFileSync(new URL("status.json", root), "utf8"));
const ticketDirectory = new URL("tickets/", root);

const ticketFiles = readdirSync(ticketDirectory)
  .filter((name) => name.endsWith(".md"))
  .sort();

const rows = ticketFiles.map((name) => {
  const content = readFileSync(new URL(`tickets/${name}`, root), "utf8");
  const id = content.match(/^id:\s*(.+)$/m)?.[1]?.trim() ?? name;
  const state = content.match(/^status:\s*(.+?)(?:\s+#.*)?$/m)?.[1]?.trim() ?? "unknown";
  const checks = [...content.matchAll(/^- \[([ x])\] /gm)];
  const complete = checks.filter((match) => match[1] === "x").length;
  const weight = status.weights[id] ?? 0;
  const ratio = state === "done" && checks.length > 0 ? complete / checks.length : 0;
  return { id, state, complete, total: checks.length, weight, earned: weight * ratio };
}).filter((row) => status.ticketOrder.includes(row.id))
  .sort((left, right) => status.ticketOrder.indexOf(left.id) - status.ticketOrder.indexOf(right.id));

const completion = rows.reduce((sum, row) => sum + row.earned, 0);
const active = rows.find((row) => row.state === "active") ?? rows.find((row) => row.state === "blocked");

console.log("Yagoo-dori v1 — verified status");
console.log(`Core objective: ${status.objective}`);
console.log(`Current milestone: ${active ? `${active.id} (${active.state})` : "No active ticket"}`);
console.log(`Overall completion: ${completion.toFixed(1)}%`);
console.log("");

for (const row of rows) {
  console.log(`${row.id.padEnd(3)} ${row.state.padEnd(8)} ${String(row.complete).padStart(2)}/${String(row.total).padEnd(2)} criteria  ${row.earned.toFixed(1)}/${row.weight}%`);
}

console.log("");
console.log(`Completed since last report: ${status.completedSinceLastReport.join("; ") || "None recorded"}`);
console.log(`Blockers: ${status.blockers.join("; ") || "None"}`);
console.log(`Next unblocked action: ${status.nextAction}`);
