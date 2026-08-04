import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(repositoryRoot, "apps", "web", "src");
const ledgerPath = path.join(repositoryRoot, "scripts", "copy-audit-ledger.json");
const artifactPath = path.join(repositoryRoot, "data", "native", "public-copy-audit-v1.json");
const terms = [
  "best",
  "optimal",
  "exact",
  "exhaustive",
  "global",
  "certified",
  "certificate",
  "proof",
  "proven",
  "score",
];
const termPattern = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
const dispositions = new Set(["allowed-scoped", "non-technical", "violation"]);

function normalizeContextSnippet(value) {
  return value.replace(/\s+/g, " ").trim();
}

function canonicalize(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return `[${value.filter((entry) => entry !== undefined).map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function relativeFile(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function sourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "e2e") files.push(...sourceFiles(filePath));
      continue;
    }
    if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\./.test(entry.name) &&
      !filePath.split(path.sep).includes("e2e")
    ) {
      files.push(filePath);
    }
  }
  return files.sort();
}

function addTextOccurrence(occurrences, { file, text, location, sourceKind, jsonPath }) {
  const context = normalizeContextSnippet(text);
  if (!context) return;
  for (const match of context.matchAll(termPattern)) {
    occurrences.push({
      file,
      context,
      term: match[0].toLowerCase(),
      location,
      sourceKind,
      ...(jsonPath ? { jsonPath } : {}),
    });
  }
}

function collectSourceOccurrences() {
  const occurrences = [];
  for (const filePath of sourceFiles(sourceRoot)) {
    const file = relativeFile(filePath);
    const sourceText = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const location = `${file}:${line}`;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        addTextOccurrence(occurrences, {
          file,
          text: node.text,
          location,
          sourceKind: "source-string",
        });
      } else if (ts.isTemplateExpression(node)) {
        addTextOccurrence(occurrences, {
          file,
          text: node.head.text,
          location,
          sourceKind: "template-quasi",
        });
        for (const span of node.templateSpans) {
          addTextOccurrence(occurrences, {
            file,
            text: span.literal.text,
            location,
            sourceKind: "template-quasi",
          });
        }
      } else if (ts.isJsxText(node)) {
        addTextOccurrence(occurrences, {
          file,
          text: node.text,
          location,
          sourceKind: "jsx-text",
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return occurrences;
}

function addJsonOccurrence(occurrences, file, jsonPath, value) {
  addTextOccurrence(occurrences, {
    file,
    text: value,
    location: `${file}:${jsonPath}`,
    sourceKind: "generated-prose",
    jsonPath,
  });
}

// Guide prose is discovered by path-name heuristics over the whole document
// (same approach as the rankings scan) so newly rendered fields like song
// titles cannot silently escape the audit; over-collection is classified in
// the ledger rather than skipped.
function isGuideProsePath(pathParts) {
  const lastPart = String(pathParts.at(-1) ?? "");
  return /^(benefit|caption|caveat|cost|description|label|prose|reason|songTitle|statement|summary|text|title|cardTitle|leaderCardTitle|name)$/i.test(
    lastPart,
  );
}

function collectGuideOccurrences() {
  const file = "data/generated/native-guides.json";
  const data = JSON.parse(fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
  const occurrences = [];
  const visit = (value, pathParts) => {
    if (typeof value === "string") {
      if (isGuideProsePath(pathParts)) {
        addJsonOccurrence(occurrences, file, pathParts.join("."), value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) {
        visit(entry, [...pathParts.slice(0, -1), `${pathParts.at(-1)}[${index}]`]);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) visit(entry, [...pathParts, key]);
    }
  };
  visit(data, []);
  return occurrences;
}

function isRankingProsePath(pathParts) {
  const lastPart = String(pathParts.at(-1) ?? "");
  return (
    /^(caption|caveat|description|label|prose|reason|statement|summary|text|title)$/i.test(lastPart) ||
    pathParts.some((part) => /^(changelog|provisionalReasons)$/i.test(String(part)))
  );
}

function collectRankingOccurrences() {
  const file = "data/generated/native-rankings.json";
  const data = JSON.parse(fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
  const occurrences = [];
  const visit = (value, pathParts) => {
    if (typeof value === "string") {
      if (isRankingProsePath(pathParts)) {
        addJsonOccurrence(occurrences, file, pathParts.join("."), value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...pathParts, index]));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) visit(entry, [...pathParts, key]);
    }
  };
  visit(data, []);
  return occurrences;
}

function ledgerKey({ file, context, term }) {
  return `${file}|${normalizeContextSnippet(context)}|${term.toLowerCase()}`;
}

function loadLedger() {
  const parsed = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const entries = parsed.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error("Copy audit ledger must contain an object-valued entries map");
  }
  return entries;
}

function classifyOccurrences(occurrences, entries) {
  return occurrences.map((occurrence) => {
    const entry = entries[ledgerKey(occurrence)];
    if (!entry) {
      return {
        ...occurrence,
        disposition: "unresolved",
        justification: "No disposition ledger entry matches this file, context, and term.",
      };
    }
    if (
      typeof entry !== "object" ||
      !dispositions.has(entry.disposition) ||
      typeof entry.justification !== "string" ||
      !entry.justification.trim() ||
      entry.justification.includes("\n")
    ) {
      return {
        ...occurrence,
        disposition: "violation",
        justification: "The matching disposition ledger entry is malformed.",
      };
    }
    return {
      ...occurrence,
      disposition: entry.disposition,
      justification: entry.justification,
    };
  });
}

function writeArtifact(classified) {
  const sorted = [...classified].sort((left, right) =>
    `${left.file}|${left.context}|${left.term}|${left.location}`.localeCompare(
      `${right.file}|${right.context}|${right.term}|${right.location}`,
    ),
  );
  const report = {
    schemaVersion: 1,
    termCounts: Object.fromEntries(
      terms.map((term) => [term, sorted.filter((entry) => entry.term === term).length]),
    ),
    dispositionCounts: Object.fromEntries(
      ["allowed-scoped", "non-technical", "violation", "unresolved"].map((disposition) => [
        disposition,
        sorted.filter((entry) => entry.disposition === disposition).length,
      ]),
    ),
    occurrenceCount: sorted.length,
    occurrences: sorted,
    violations: sorted.filter((entry) => entry.disposition === "violation"),
    unresolved: sorted.filter((entry) => entry.disposition === "unresolved"),
    runtimeMetadata: undefined,
  };
  const stableDigest = sha256(report);
  const artifact = {
    ...report,
    stableDigest,
    runtimeMetadata: { generatedAt: new Date().toISOString() },
  };
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { report: artifact, stableDigest };
}

const occurrences = [
  ...collectSourceOccurrences(),
  ...collectGuideOccurrences(),
  ...collectRankingOccurrences(),
];
const classified = classifyOccurrences(occurrences, loadLedger());
const { report, stableDigest } = writeArtifact(classified);
const failures = [...report.violations, ...report.unresolved];

console.log(
  `Copy audit ${failures.length === 0 ? "PASS" : "FAIL"}: ${report.occurrenceCount} occurrences; ` +
    `terms ${JSON.stringify(report.termCounts)}; dispositions ${JSON.stringify(report.dispositionCounts)}; ` +
    `stableDigest ${stableDigest}`,
);
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `${failure.disposition}: ${failure.file} ${failure.term} ${failure.location} — ${failure.context}`,
    );
  }
  process.exitCode = 1;
}
