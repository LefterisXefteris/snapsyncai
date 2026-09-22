import { apiFetch } from "./api-fetch";

/** Load a private photo via the authenticated API and return a blob URL. */
export async function fetchImageObjectUrl(path: string): Promise<string | null> {
  const res = await apiFetch(path);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size === 0) return null;
  return URL.createObjectURL(blob);
}
