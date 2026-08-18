import assert from "node:assert";
import test from "node:test";

import {
  createIndexBuilder,
  ensureEntry,
  finalizeIndex,
  findUnresolvedXref,
  type IndexBuilder,
} from "../src/model.ts";

const group = { html: "ち", reading: "ち" };
const intellectualProperty = { html: "知的財産権", reading: "ちてきざいさんけん" };

function createBuilder(): IndexBuilder {
  const builder = createIndexBuilder();
  ensureEntry(builder, { group, entry: intellectualProperty });
  ensureEntry(builder, { group, entry: { html: "著作権", reading: "ちょさくけん" } });
  return builder;
}

void test("accepts cross-references to registered entries", () => {
  assert.strictEqual(
    findUnresolvedXref(createBuilder(), { group, entry: intellectualProperty }),
    undefined,
  );
});

void test("reports cross-references to unregistered entries", () => {
  const entry = { html: "工業所有権", reading: "こうぎょうしょゆうけん" };

  assert.deepStrictEqual(findUnresolvedXref(createBuilder(), { group, entry }), {
    target: { group, entry },
    missing: "entry",
  });
});

void test("reports a cross-reference that uses different inner HTML", () => {
  const entry = { html: "<em>知的財産権</em>", reading: "ちてきざいさんけん" };

  assert.strictEqual(findUnresolvedXref(createBuilder(), { group, entry })?.missing, "entry");
});

void test("reports a missing group before a missing heading", () => {
  assert.strictEqual(
    findUnresolvedXref(createBuilder(), {
      group: { html: "こ", reading: "こ" },
      entry: intellectualProperty,
    })?.missing,
    "group",
  );
});

void test("reports a missing subentry of a registered heading", () => {
  assert.strictEqual(
    findUnresolvedXref(createBuilder(), {
      group,
      entry: intellectualProperty,
      subentry: { html: "特許権", reading: "とっきょけん" },
    })?.missing,
    "subentry",
  );
});

void test("distinguishes headings that share HTML but not their reading", () => {
  const builder = createIndexBuilder();
  const first = { html: "One", reading: "ichi" };
  const second = { html: "One", reading: "hitotsu" };

  ensureEntry(builder, { group, entry: first });
  ensureEntry(builder, { group, entry: second });

  assert.deepStrictEqual(
    finalizeIndex(builder).groups[0]?.entries.map(({ key }) => key.reading),
    ["ichi", "hitotsu"],
  );
  assert.strictEqual(
    findUnresolvedXref(builder, { group, entry: { html: "One", reading: "san" } })?.missing,
    "entry",
  );
});
