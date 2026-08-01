const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes root-relative public assets for repository-scoped GitHub Pages. */
export function sitePath(path: string): string {
  if (!basePath || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}
