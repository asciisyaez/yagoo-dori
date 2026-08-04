import { readFileSync, statSync } from "node:fs";

export const DEFAULT_MAX_JSON_BYTES = 128 * 1024 * 1024;
export const DEFAULT_MAX_JSON_DEPTH = 64;

function rejection(filePath, message) {
  return new Error(`Bounded JSON read rejected ${filePath}: ${message}`);
}

function validateTree(value, filePath, depth, maxDepth) {
  if (value === null || typeof value !== "object") return;
  if (depth > maxDepth) {
    throw rejection(filePath, `JSON depth cap ${maxDepth} exceeded`);
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => validateTree(entry, filePath, depth + 1, maxDepth));
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw rejection(filePath, "JSON object has a non-plain prototype");
  }
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "constructor") {
      throw rejection(filePath, `forbidden own key ${JSON.stringify(key)}`);
    }
    validateTree(value[key], filePath, depth + 1, maxDepth);
  }
}

export function readBoundedJson(
  filePath,
  { maxBytes = DEFAULT_MAX_JSON_BYTES, maxDepth = DEFAULT_MAX_JSON_DEPTH } = {},
) {
  // The cap must reject BEFORE allocating the file contents, or a corrupt
  // multi-gigabyte artifact exhausts memory ahead of the bound.
  const declaredSize = statSync(filePath).size;
  if (declaredSize > maxBytes) {
    throw rejection(filePath, `byte cap ${maxBytes} exceeded (${declaredSize} bytes)`);
  }
  const bytes = readFileSync(filePath);
  if (bytes.length > maxBytes) {
    throw rejection(filePath, `byte cap ${maxBytes} exceeded (${bytes.length} bytes)`);
  }

  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw rejection(filePath, "invalid JSON");
  }
  validateTree(parsed, filePath, 0, maxDepth);
  return parsed;
}
