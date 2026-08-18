import assert from "node:assert";
import test from "node:test";

import {
  createKey,
  createIndexBuilder,
  ensureEntry,
  finalizeIndex,
  findUnresolvedXref,
  type IndexBuilder,
} from "../src/model.ts";

const group = createKey("ち", "ち");
const intellectualProperty = createKey("ちてきざいさんけん", "知的財産権");

function createBuilder(): IndexBuilder {
  const builder = createIndexBuilder();
  ensureEntry(builder, { group, entry: intellectualProperty });
  ensureEntry(builder, { group, entry: createKey("ちょさくけん", "著作権") });
  return builder;
}

void test("accepts cross-references to registered entries", () => {
  assert.strictEqual(
    findUnresolvedXref(createBuilder(), { group, entry: intellectualProperty }),
    undefined,
  );
});

void test("reports cross-references to unregistered entries", () => {
  const entry = createKey("こうぎょうしょゆうけん", "工業所有権");

  assert.deepStrictEqual(findUnresolvedXref(createBuilder(), { group, entry }), {
    target: { group, entry },
    missing: "entry",
  });
});

void test("reports a cross-reference that uses different inner HTML", () => {
  const entry = createKey("ちてきざいさんけん", "<em>知的財産権</em>");

  assert.strictEqual(findUnresolvedXref(createBuilder(), { group, entry })?.missing, "entry");
});

void test("reports a missing group before a missing heading", () => {
  assert.strictEqual(
    findUnresolvedXref(createBuilder(), {
      group: createKey("こ", "こ"),
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
      subentry: createKey("とっきょけん", "特許権"),
    })?.missing,
    "subentry",
  );
});

void test("distinguishes headings that share HTML but not their reading", () => {
  const builder = createIndexBuilder();
  const first = createKey("ichi", "One");
  const second = createKey("hitotsu", "One");

  ensureEntry(builder, { group, entry: first });
  ensureEntry(builder, { group, entry: second });

  assert.deepStrictEqual(
    finalizeIndex(builder).groups[0]?.entries.map(({ key }) => key.reading),
    ["ichi", "hitotsu"],
  );
  assert.strictEqual(
    findUnresolvedXref(builder, { group, entry: createKey("san", "One") })?.missing,
    "entry",
  );
});
