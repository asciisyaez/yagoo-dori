import { createReadStream } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportRoot = path.join(repositoryRoot, "apps", "web", "out");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".svg", ".txt"]);

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index !== -1) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    return value;
  }
  const prefix = `${name}=`;
  return argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function assertKnownOptions(argv) {
  const valueOptions = new Set(["--base-path", "--host", "--port"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") continue;
    if ([...valueOptions].some((option) => argument.startsWith(`${option}=`))) continue;
    if (valueOptions.has(argument)) {
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
}

function normalizeBasePath(value) {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "/") return "";
  const normalized = `${trimmed.startsWith("/") ? "" : "/"}${trimmed}`.replace(/\/+$/, "");
  const segments = normalized.slice(1).split("/");
  if (
    normalized.includes("\\") ||
    normalized.includes("//") ||
    normalized.includes("?") ||
    normalized.includes("#") ||
    segments.some((segment) => !/^[A-Za-z0-9._~-]+$/.test(segment) || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid Pages base path: ${JSON.stringify(value)}.`);
  }
  return normalized;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${JSON.stringify(value)}.`);
  }
  return port;
}

function decodeRelativePath(encodedPath) {
  if (encodedPath === "" || encodedPath === "/") return [];
  const segments = encodedPath.replace(/^\/+/, "").split("/");
  return segments.filter(Boolean).map((encodedSegment) => {
    let segment;
    try {
      segment = decodeURIComponent(encodedSegment);
    } catch {
      throw new Error("Malformed URL encoding.");
    }
    if (
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      throw new Error("Unsafe path segment.");
    }
    return segment;
  });
}

function insideExportRoot(candidate) {
  const relative = path.relative(exportRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function existingFile(candidate) {
  if (!insideExportRoot(candidate)) return null;
  try {
    const details = await stat(candidate);
    if (!details.isFile()) return null;
    const resolved = await realpath(candidate);
    return insideExportRoot(resolved) ? { path: resolved, size: details.size } : null;
  } catch {
    return null;
  }
}

async function resolveRequest(segments, pathnameEndsWithSlash) {
  const exactPath = path.join(exportRoot, ...segments);
  const exactFile = await existingFile(exactPath);
  if (exactFile) return { ...exactFile, redirect: false };

  try {
    const details = await stat(exactPath);
    if (details.isDirectory()) {
      if (!pathnameEndsWithSlash) return { redirect: true };
      const indexFile = await existingFile(path.join(exactPath, "index.html"));
      if (indexFile) return { ...indexFile, redirect: false };
    }
  } catch {
    // Continue to Pages-style extensionless HTML lookup.
  }

  if (!pathnameEndsWithSlash && segments.length > 0) {
    const htmlFile = await existingFile(`${exactPath}.html`);
    if (htmlFile) return { ...htmlFile, redirect: false };
  }
  return null;
}

function cacheControl(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  if (normalized.includes("/_next/static/")) return "public, max-age=31536000, immutable";
  if (path.extname(filePath) === ".html" || path.basename(filePath) === "healthz") return "no-store";
  return "public, max-age=3600";
}

async function sendFile(request, response, file) {
  const extension = path.extname(file.path).toLowerCase();
  const useGzip =
    file.size >= 1_024 &&
    compressibleExtensions.has(extension) &&
    /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers["accept-encoding"] ?? "");
  const headers = {
    "Cache-Control": cacheControl(file.path),
    "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  };
  if (useGzip) {
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  } else {
    headers["Content-Length"] = file.size;
  }
  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  if (useGzip) await pipeline(createReadStream(file.path), createGzip(), response);
  else await pipeline(createReadStream(file.path), response);
}

async function sendNotFound(request, response) {
  const file = await existingFile(path.join(exportRoot, "404.html"));
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : "Not found");
    return;
  }
  response.writeHead(404, {
    "Cache-Control": "no-store",
    "Content-Length": file.size,
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(file.path).pipe(response);
}

function printHelp() {
  process.stdout.write("Serve the static GitHub Pages export beneath its repository prefix.\n\n");
  process.stdout.write("Usage: pnpm preview:pages -- [--base-path /yagoo-dori] [--port 3100] [--host 127.0.0.1]\n");
}

async function main() {
  const argv = process.argv.slice(2);
  assertKnownOptions(argv);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const basePath = normalizeBasePath(
    readOption(argv, "--base-path") ?? process.env.YAGOO_DORI_BASE_PATH ?? "/yagoo-dori",
  );
  const host = readOption(argv, "--host") ?? process.env.HOST ?? "127.0.0.1";
  const port = parsePort(readOption(argv, "--port") ?? process.env.PORT ?? "3100");
  const indexPath = path.join(exportRoot, "index.html");
  await access(indexPath);

  const indexHtml = await readFile(indexPath, "utf8");
  const expectedAssetPrefix = `${basePath}/_next/`;
  if (!indexHtml.includes(expectedAssetPrefix)) {
    throw new Error(
      `The export does not match base path ${JSON.stringify(basePath)}. Rebuild it before previewing.`,
    );
  }

  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
        response.end("Method not allowed");
        return;
      }

      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const pathname = requestUrl.pathname;
      if (basePath && pathname === basePath) {
        response.writeHead(308, { Location: `${basePath}/${requestUrl.search}` });
        response.end();
        return;
      }
      if (basePath && !pathname.startsWith(`${basePath}/`)) {
        await sendNotFound(request, response);
        return;
      }

      const relativePath = basePath ? pathname.slice(basePath.length) : pathname;
      let segments;
      try {
        segments = decodeRelativePath(relativePath);
      } catch {
        await sendNotFound(request, response);
        return;
      }

      const file = await resolveRequest(segments, pathname.endsWith("/"));
      if (!file) {
        await sendNotFound(request, response);
        return;
      }
      if (file.redirect) {
        response.writeHead(308, { Location: `${pathname}/${requestUrl.search}` });
        response.end();
        return;
      }
      await sendFile(request, response, file);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Internal server error");
      } else {
        response.destroy();
      }
    }
  });

  server.listen(port, host, () => {
    process.stdout.write(`GitHub Pages export available at http://${host}:${port}${basePath}/\n`);
  });

  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
