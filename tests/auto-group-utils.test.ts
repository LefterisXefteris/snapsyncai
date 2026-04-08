import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApparelIdentityProfile,
  buildAutoGroupMergePrompt,
  buildAutoGroupSystemPrompt,
  buildCandidateBucketKey,
  mergeAutoGroupsByFamily,
  normalizeAutoGroupLabel,
} from "../server/auto-group-utils.ts";
import { buildAutoGroupRequestPayload } from "../client/src/hooks/use-auto-group.ts";

test("normalizes color and view words out of auto-group labels", () => {
  assert.equal(
    normalizeAutoGroupLabel("Blue Denim Jacket Front View"),
    "denim jacket",
  );
});

test("identity profile keeps apparel family details while stripping variant noise", () => {
  const profile = buildApparelIdentityProfile("title: Cream Eagle Graphic Tee Front View");

  assert.equal(profile.garmentType, "tee");
  assert.equal(profile.familyKey, "eagle tee");
  assert.equal(profile.mergeStrength, "strong");
});

test("merges groups that only differ by color-specific labels", () => {
  const merged = mergeAutoGroupsByFamily([
    {
      label: "Blue Denim Jacket",
      imageIndices: [0, 1],
      confidence: "high",
    },
    {
      label: "Black Denim Jacket",
      imageIndices: [2, 3],
      confidence: "medium",
    },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].label, "Denim Jacket");
  assert.equal(merged[0].familyKey, "denim jacket");
  assert.deepEqual(merged[0].imageIndices, [0, 1, 2, 3]);
  assert.equal(merged[0].confidence, "high");
});

test("keeps distinct product families separate", () => {
  const merged = mergeAutoGroupsByFamily([
    {
      label: "Blue Denim Jacket",
      imageIndices: [0],
      confidence: "high",
    },
    {
      label: "Black Denim Jeans",
      imageIndices: [1],
      confidence: "high",
    },
  ]);

  assert.equal(merged.length, 2);
});

test("keeps same base garment with different graphics separate", () => {
  const merged = mergeAutoGroupsByFamily([
    {
      label: "Cream Eagle Graphic Tee",
      familyKey: "graphic tee",
      descriptor: "title: Cream Eagle Graphic Tee | category: tops | filename: cream-eagle-front.jpg",
      imageIndices: [0, 1],
      confidence: "high",
    },
    {
      label: "Black World Tour Graphic Tee",
      familyKey: "graphic tee",
      descriptor: "title: Black World Tour Graphic Tee | category: tops | filename: black-world-tour-front.jpg",
      imageIndices: [2, 3],
      confidence: "high",
    },
  ]);

  assert.equal(merged.length, 2);
});

test("keeps different trouser cuts separate", () => {
  const merged = mergeAutoGroupsByFamily([
    {
      label: "Stone Wide Leg Trouser",
      descriptor: "title: Stone Wide Leg Trouser | category: bottoms",
      imageIndices: [0],
      confidence: "high",
    },
    {
      label: "Taupe Straight Leg Trouser",
      descriptor: "title: Taupe Straight Leg Trouser | category: bottoms",
      imageIndices: [1],
      confidence: "high",
    },
  ]);

  assert.equal(merged.length, 2);
});

test("auto-group system prompt explicitly calls out variants as one group", () => {
  const prompt = buildAutoGroupSystemPrompt("variant-family", "fashion reseller");

  assert.match(prompt, /different colors = same group/i);
  assert.match(prompt, /different sizes = same group/i);
  assert.match(prompt, /different front graphics/i);
  assert.match(prompt, /different base silhouettes/i);
  assert.match(prompt, /familyKey/i);
});

test("merge prompt asks for canonical family grouping", () => {
  const prompt = buildAutoGroupMergePrompt("variant-family");

  assert.match(prompt, /same underlying product family/i);
  assert.match(prompt, /different front graphics/i);
  assert.match(prompt, /base garment structures/i);
  assert.match(prompt, /canonical family key/i);
});

test("candidate bucket key separates obvious garment categories", () => {
  assert.equal(buildCandidateBucketKey("title: Cream Eagle Graphic Tee | category: tops"), "tee");
  assert.equal(buildCandidateBucketKey("title: Stone Wide Leg Trouser | category: bottoms"), "trouser");
});

test("request payload defaults to standard auto-group mode", () => {
  const payload = buildAutoGroupRequestPayload([
    { index: 0, base64: "abc", mimeType: "image/jpeg", filename: "look-1.jpg" },
  ]);

  assert.equal(payload.mode, "default");
});

test("request payload can opt into variant-family mode", () => {
  const payload = buildAutoGroupRequestPayload(
    [{ index: 0, base64: "abc", mimeType: "image/jpeg", filename: "look-1.jpg" }],
    "fashion reseller",
    "variant-family",
  );

  assert.equal(payload.mode, "variant-family");
  assert.equal(payload.productContext, "fashion reseller");
});
