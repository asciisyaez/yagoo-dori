// Read-only live-site smoke probes. Gated behind YAGOO_DORI_LIVE_SMOKE=1 so
// no automated chain touches the network without an explicit opt-in. This
// script only issues GET requests against the deployed site; it never writes,
// deploys, or changes any setting, and it must not assert local-only copy
// changes that are not yet deployed.
const ORIGIN = "https://asciisyaez.github.io";
const BASE_PATH = "/yagoo-dori";
const ROUTES = ["/", "/cards/", "/tier-list/", "/team-builder/", "/guides/", "/talents/", "/methodology/", "/sitemap.xml"];
const DISCLAIMER = "Unofficial fan site; not affiliated with COVER Corp. or QualiArts.";

if (process.env.YAGOO_DORI_LIVE_SMOKE !== "1") {
  process.stdout.write("live smoke skipped: set YAGOO_DORI_LIVE_SMOKE=1 to run read-only probes\n");
  process.exit(0);
}

const failures = [];
for (const route of ROUTES) {
  const url = `${ORIGIN}${BASE_PATH}${route}`;
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    if (response.status !== 200) {
      failures.push(`${url}: HTTP ${response.status}`);
      continue;
    }
    if (route === "/") {
      const html = await response.text();
      // The exactly-once invariant is about rendered text; the RSC flight
      // payload inside <script> tags legitimately repeats page strings.
      const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
      const count = withoutScripts.split(DISCLAIMER).length - 1;
      if (count !== 1) failures.push(`${url}: disclaimer appears ${count} times outside scripts, expected exactly 1`);
    }
  } catch (error) {
    failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`live smoke FAILED:\n${failures.map((line) => `  ${line}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`live smoke PASS: ${ROUTES.length} routes HTTP 200; disclaimer exactly once on /\n`);
