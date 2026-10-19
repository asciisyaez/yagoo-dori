import { resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function githubContentsUrl(rawUrl) {
  const match = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(rawUrl);
  if (!match) return null;
  const [, owner, repository, commit, rawPath] = match;
  const encodedPath = rawPath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `https://api.github.com/repos/${owner}/${repository}/contents/${encodedPath}?ref=${commit}`;
}

function localMirrorPath(rawUrl) {
  const root = process.env.HOLODORI_DB_MIRROR_ROOT;
  if (!root) return null;
  const match = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(rawUrl);
  if (!match) return null;
  const [, owner, repository, commit, rawPath] = match;
  if (owner !== "HolodoriDB" || !/^holodori-db-(eng|jpn)-diff$/.test(repository)) return null;
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Mirror requests require an immutable commit: ${rawUrl}`);
  const mirrorDirectory = repository.endsWith("-eng-diff")
    ? "eng"
    : repository.endsWith("-jpn-diff")
      ? "jpn"
      : repository;
  const mirrorRoot = resolve(root);
  const candidate = resolve(mirrorRoot, mirrorDirectory, rawPath);
  const mirrorDirectoryRoot = resolve(mirrorRoot, mirrorDirectory);
  if (candidate !== mirrorDirectoryRoot && !candidate.startsWith(`${mirrorDirectoryRoot}${sep}`)) {
    throw new Error(`Refusing mirror path outside root: ${rawUrl}`);
  }
  return { directory: mirrorDirectoryRoot, commit, rawPath };
}

export async function fetchGithubRaw(
  url,
  { accept = "application/json", userAgent, timeoutMs = 30_000 } = {},
) {
  const mirror = localMirrorPath(url);
  if (mirror) {
    try {
      // Read the pinned Git object, never a different HEAD or dirty working tree.
      const { stdout: bytes } = await execFileAsync("git", ["-C", mirror.directory,
        "show", `${mirror.commit}:${mirror.rawPath}`], { encoding: "buffer", maxBuffer: 128 * 1024 * 1024 });
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      throw new Error(`Public mirror cannot supply ${mirror.commit}:${mirror.rawPath}. Fetch the pinned commit into ${mirror.directory} or unset HOLODORI_DB_MIRROR_ROOT.`, { cause: error });
    }
  }

  const headers = { accept, "user-agent": userAgent };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;

      const fallbackUrl = githubContentsUrl(url);
      if (fallbackUrl && (response.status === 403 || response.status === 429)) {
        const fallback = await fetch(fallbackUrl, {
          headers: {
            accept: "application/vnd.github.raw+json",
            "user-agent": userAgent,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (fallback.ok) return fallback;
        lastError = new Error(`Fallback failed ${fallback.status} ${fallback.statusText}: ${fallbackUrl}`);
      } else {
        lastError = new Error(`Failed ${response.status} ${response.statusText}: ${url}`);
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  throw lastError;
}
