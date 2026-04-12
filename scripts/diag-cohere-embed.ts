// Throwaway diagnostic for debug session embedding-clustering-over-merge.
// Run: tsx scripts/diag-cohere-embed.ts
//
// Goal: determine which of H1/H2/H3 is the real root cause by inspecting
// raw pairwise cosine similarities of embeddings for 4 visually distinct
// real images, using the exact production call path.

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  embedImagesCohere,
  cosineSimilarity,
} from "../server/embedding-utils";

// Scenario selectable via CLI arg: `distinct` (4 obviously different) or
// `homogeneous` (6 app screenshots from same UI session — mimics a real
// workspace where all photos share a background/aesthetic but show different
// products).
const SCENARIOS: Record<string, string[]> = {
  distinct: [
    "attached_assets/IMG_3839_1770982557515.png",
    "attached_assets/IMG_3841_1770985787157.png",
    "attached_assets/Screenshot_2026-02-13_at_20.00.39_1771012844351.png",
    "attached_assets/Screenshot_2026-02-23_at_21.20.23_1771881625736.png",
  ],
  homogeneous: [
    "attached_assets/Screenshot_2026-02-13_at_20.00.39_1771012844351.png",
    "attached_assets/Screenshot_2026-02-13_at_20.02.39_1771012962117.png",
    "attached_assets/Screenshot_2026-02-13_at_20.03.28_1771013012934.png",
    "attached_assets/Screenshot_2026-02-13_at_20.07.19_1771013241299.png",
    "attached_assets/Screenshot_2026-02-20_at_19.06.03_1771614366802.png",
    "attached_assets/Screenshot_2026-02-20_at_19.11.55_1771614718461.png",
  ],
};
const scenario = process.argv[2] ?? "distinct";
const TEST_IMAGES = SCENARIOS[scenario];
if (!TEST_IMAGES) {
  console.error(`Unknown scenario "${scenario}". Options: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(1);
}
console.log(`Scenario: ${scenario}`);

async function main() {
  const cwd = process.cwd();
  const inputs = await Promise.all(
    TEST_IMAGES.map(async (rel) => {
      const buf = await fs.readFile(path.join(cwd, rel));
      return {
        base64: buf.toString("base64"),
        mimeType: "image/png",
      };
    }),
  );

  console.log(`Embedding ${inputs.length} distinct images via embedImagesCohere…`);
  const vectors = await embedImagesCohere(inputs);

  console.log(`\nGot ${vectors.length} vectors.`);
  vectors.forEach((v, i) => {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    console.log(
      `  [${i}] dim=${v.length} norm=${norm.toFixed(4)} first5=[${v.slice(0, 5).map((x) => x.toFixed(4)).join(", ")}]`,
    );
  });

  // Check if vectors are identical (H3)
  let allIdentical = true;
  for (let i = 1; i < vectors.length; i++) {
    for (let j = 0; j < vectors[0].length; j++) {
      if (vectors[0][j] !== vectors[i][j]) {
        allIdentical = false;
        break;
      }
    }
    if (!allIdentical) break;
  }
  console.log(`\nAll vectors identical? ${allIdentical ? "YES (H3 CONFIRMED)" : "no"}`);

  console.log("\nPairwise cosine similarity matrix:");
  const header = "        " + vectors.map((_, j) => `   [${j}]  `).join("");
  console.log(header);
  for (let i = 0; i < vectors.length; i++) {
    const row = vectors
      .map((_, j) => cosineSimilarity(vectors[i], vectors[j]).toFixed(4))
      .join("  ");
    console.log(`  [${i}]  ${row}`);
  }

  console.log("\nInterpretation:");
  console.log("  - All off-diagonal ≈ 1.0000 → H3 (same vector per image, Cohere batching broken)");
  console.log("  - Off-diagonal ≈ 0.85-0.95 but norms != 1.0 → H2 (normalization)");
  console.log("  - Off-diagonal ≈ 0.80-0.85 with norms ≈ 1.0 → H1 (threshold 0.78 too loose)");
  console.log("  - Off-diagonal < 0.78 → embeddings are fine, bug is elsewhere");
}

main().catch((err) => {
  console.error("DIAG FAILED:", err);
  process.exit(1);
});
