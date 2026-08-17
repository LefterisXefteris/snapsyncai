/**
 * Single seam for SPA API URLs.
 *
 * Unset (local Vite proxy and current production Express): relative `/api/...`.
 * Set to `https://api.snapsyncai.co.uk` at Railway cutover: absolute URLs.
 */
function viteApiOrigin(): string | undefined {
  const value = import.meta.env?.VITE_API_ORIGIN;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function apiUrl(path: string, origin: string | undefined = viteApiOrigin()): string {
  const base = (origin ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}
