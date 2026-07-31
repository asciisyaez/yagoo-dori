import { cpSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(root, "apps/web");
const standaloneWebRoot = resolve(webRoot, ".next/standalone/apps/web");
const server = resolve(standaloneWebRoot, "server.js");

if (!existsSync(server)) {
  throw new Error("Standalone build not found. Run `pnpm build` before `pnpm start`.");
}

cpSync(resolve(webRoot, ".next/static"), resolve(standaloneWebRoot, ".next/static"), {
  recursive: true,
  force: true,
});
cpSync(resolve(webRoot, "public"), resolve(standaloneWebRoot, "public"), {
  recursive: true,
  force: true,
});

process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3000";

await import(pathToFileURL(server).href);
