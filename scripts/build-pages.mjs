import { spawn } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportDirectory = path.join(repositoryRoot, "apps", "web", "out");

function readOption(argv, name) {
  const exactIndex = argv.indexOf(name);
  if (exactIndex !== -1) {
    const value = argv[exactIndex + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${name} requires a value.`);
    }
    return value;
  }

  const prefix = `${name}=`;
  const inline = argv.find((argument) => argument.startsWith(prefix));
  return inline?.slice(prefix.length);
}

function normalizeBasePath(value) {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "");

  if (
    normalized.includes("\\") ||
    normalized.includes("?") ||
    normalized.includes("#") ||
    normalized.includes("//") ||
    normalized.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid GitHub Pages base path: ${JSON.stringify(value)}.`);
  }

  return normalized;
}

function normalizeSiteUrl(value, basePath) {
  let siteUrl;
  try {
    siteUrl = new URL(value);
  } catch {
    throw new Error(`Invalid site URL: ${JSON.stringify(value)}.`);
  }

  if (
    !["http:", "https:"].includes(siteUrl.protocol) ||
    siteUrl.username !== "" ||
    siteUrl.password !== "" ||
    siteUrl.search !== "" ||
    siteUrl.hash !== ""
  ) {
    throw new Error("The site URL must be an HTTP(S) URL without credentials, a query, or a fragment.");
  }

  const urlBasePath = normalizeBasePath(siteUrl.pathname);
  if (urlBasePath !== basePath) {
    throw new Error(
      `Site URL path ${JSON.stringify(urlBasePath)} does not match base path ${JSON.stringify(basePath)}.`,
    );
  }

  siteUrl.pathname = basePath || "/";
  return siteUrl.toString().replace(/\/$/, "");
}

function assertKnownOptions(argv) {
  const optionsWithValues = new Set(["--base-path", "--site-url"]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      continue;
    }
    if ([...optionsWithValues].some((option) => argument.startsWith(`${option}=`))) {
      continue;
    }
    if (optionsWithValues.has(argument)) {
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
}

function printHelp() {
  process.stdout.write(`Build the static GitHub Pages export.\n\n`);
  process.stdout.write(`Usage: pnpm build:pages -- [options]\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --base-path <path>  Repository path, for example /yagoo-dori\n`);
  process.stdout.write(`  --site-url <url>    Full public URL, including the repository path\n`);
  process.stdout.write(`  -h, --help          Show this help\n\n`);
  process.stdout.write(`Environment equivalents: YAGOO_DORI_BASE_PATH, YAGOO_DORI_SITE_URL.\n`);
}

async function runPnpm(arguments_, environment) {
  const npmExecutable = process.env.npm_execpath;
  const useNodeEntrypoint = npmExecutable && /\.(?:c?js|mjs)$/i.test(npmExecutable);
  const command = useNodeEntrypoint ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const commandArguments = useNodeEntrypoint ? [npmExecutable, ...arguments_] : arguments_;

  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArguments, {
      cwd: repositoryRoot,
      env: environment,
      shell: false,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`pnpm ${arguments_.join(" ")} terminated by ${signal}.`));
      } else if (code !== 0) {
        reject(new Error(`pnpm ${arguments_.join(" ")} exited with code ${code}.`));
      } else {
        resolve();
      }
    });
  });
}

async function countFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory() ? await countFiles(entryPath) : 1;
  }

  return total;
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
  const siteUrl = normalizeSiteUrl(
    readOption(argv, "--site-url") ??
      process.env.YAGOO_DORI_SITE_URL ??
      `https://asciisyaez.github.io${basePath}`,
    basePath,
  );
  const environment = {
    ...process.env,
    YAGOO_DORI_DEPLOY_TARGET: "github-pages",
    YAGOO_DORI_BASE_PATH: basePath,
    YAGOO_DORI_SITE_URL: siteUrl,
    NEXT_PUBLIC_PUBLICATION_READY: "true",
  };

  process.stdout.write(`Building GitHub Pages export for ${siteUrl || "the site root"}\n`);
  process.stdout.write(`Base path: ${basePath || "(root)"}\n`);

  await runPnpm(["assets:check"], environment);
  await runPnpm(["data:validate"], environment);
  await runPnpm(["--filter", "@yagoo-dori/web", "build"], environment);

  const indexPath = path.join(exportDirectory, "index.html");
  await access(indexPath);
  const indexStats = await stat(indexPath);
  if (!indexStats.isFile() || indexStats.size === 0) {
    throw new Error(`Static export did not produce a usable ${path.relative(repositoryRoot, indexPath)}.`);
  }

  const indexHtml = await readFile(indexPath, "utf8");
  if (basePath && !indexHtml.includes(`${basePath}/_next/`)) {
    throw new Error(`Static export is missing the configured ${basePath}/_next/ asset prefix.`);
  }
  if (basePath && /(?:href|src)=["']\/_next\//.test(indexHtml)) {
    throw new Error("Static export contains root-relative Next.js assets that bypass the configured base path.");
  }

  const exportedFileCount = await countFiles(exportDirectory);
  process.stdout.write(
    `GitHub Pages export ready: ${path.relative(repositoryRoot, exportDirectory)} (${exportedFileCount} files).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
