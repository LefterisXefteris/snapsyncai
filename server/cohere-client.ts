import { CohereClientV2 } from "cohere-ai";

// Lazy-init singleton for the Cohere SDK client.
//
// We use CohereClientV2 (not the legacy CohereClient) because v2 is the only
// client in cohere-ai@8.x that exposes `outputDimension` on the embed call and
// accepts batched image inputs in a single request. The v1 client caps `images`
// at 1 per call, which would defeat the batching strategy in embedding-utils.ts.
//
// The type is widened to `unknown`-equivalent at the injection seam so tests can
// stub it with a minimal fake exposing only `.embed(...)`.

type MinimalCohereClient = {
  embed: CohereClientV2["embed"];
};

let cachedClient: MinimalCohereClient | null = null;

export function getCohereClient(): MinimalCohereClient {
  // If a client is already cached (e.g. injected by tests via
  // __setCohereClientForTests, or constructed by a prior call), return it
  // without re-reading the env var. This lets integration tests stub the
  // client without also having to set COHERE_API_KEY.
  if (cachedClient) {
    return cachedClient;
  }
  const token = process.env.COHERE_API_KEY;
  if (!token) {
    throw new Error("COHERE_API_KEY is not set");
  }
  cachedClient = new CohereClientV2({ token });
  return cachedClient;
}

// Test-only: clear the cached client so the env-var guard can be re-exercised.
export function __resetCohereClientForTests(): void {
  cachedClient = null;
}

// Test-only: inject a fake client (e.g. one recording embed() calls). Plan 08-02
// integration tests consume this; Plan 08-02 does NOT re-create it.
export function __setCohereClientForTests(client: unknown): void {
  cachedClient = client as MinimalCohereClient;
}
