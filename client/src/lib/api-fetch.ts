import { apiUrl } from "./api-origin";

type ClerkLike = {
  session?: { getToken: () => Promise<string | null | undefined> };
};

function clerkSession() {
  return (globalThis as typeof globalThis & { Clerk?: ClerkLike }).Clerk?.session;
}

/** Fetch `/api` with cookies plus a Clerk Bearer token when the session exists. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await clerkSession()?.getToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = path.startsWith("http://") || path.startsWith("https://") ? path : apiUrl(path);
  return fetch(url, {
    ...init,
    credentials: init.credentials ?? "include",
    headers,
  });
}
