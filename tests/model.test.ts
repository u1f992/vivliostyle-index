import assert from "node:assert";
import test from "node:test";

import { ensureEntry, findUnresolvedXref, getChild, type Index } from "../src/model.ts";
import { identityTemplate } from "../src/template.ts";

const group = { html: "ち", reading: "ち" };
const intellectualProperty = { html: "知的財産権", reading: "ちてきざいさんけん" };

function createIndex(): Index {
  return {
    groups: [
      {
        key: group,
        entries: [
          {
            key: intellectualProperty,
            subentries: [],
            locators: [],
            xrefPreferred: [],
            xrefRelated: [],
          },
          {
            key: { html: "著作権", reading: "ちょさくけん" },
            subentries: [],
            locators: [],
            xrefPreferred: [],
            xrefRelated: [
              {
                target: { group, entry: intellectualProperty },
                template: identityTemplate,
              },
            ],
          },
        ],
      },
    ],
  };
}

void test("accepts cross-references to registered entries", () => {
  assert.strictEqual(
    findUnresolvedXref(createIndex(), { group, entry: intellectualProperty }),
    undefined,
  );
});

void test("reports cross-references to unregistered entries", () => {
  const entry = { html: "工業所有権", reading: "こうぎょうしょゆうけん" };

  assert.deepStrictEqual(findUnresolvedXref(createIndex(), { group, entry }), {
    target: { group, entry },
    missing: "entry",
  });
});

void test("reports a cross-reference that uses different inner HTML", () => {
  const entry = { html: "<em>知的財産権</em>", reading: "ちてきざいさんけん" };

  assert.strictEqual(findUnresolvedXref(createIndex(), { group, entry })?.missing, "entry");
});

void test("reports a missing group before a missing heading", () => {
  assert.strictEqual(
    findUnresolvedXref(createIndex(), {
      group: { html: "こ", reading: "こ" },
      entry: intellectualProperty,
    })?.missing,
    "group",
  );
});

void test("reports a missing subentry of a registered heading", () => {
  assert.strictEqual(
    findUnresolvedXref(createIndex(), {
      group,
      entry: intellectualProperty,
      subentry: { html: "特許権", reading: "とっきょけん" },
    })?.missing,
    "subentry",
  );
});

void test("distinguishes headings that share HTML but not their reading", () => {
  const index: Index = { groups: [] };
  const first = { html: "One", reading: "ichi" };
  const second = { html: "One", reading: "hitotsu" };

  ensureEntry(index, { group, entry: first });
  ensureEntry(index, { group, entry: second });

  assert.deepStrictEqual(
    index.groups[0]?.entries.map(({ key }) => key.reading),
    ["ichi", "hitotsu"],
  );
  assert.strictEqual(
    getChild(index.groups[0]!.entries, { html: "One", reading: "san" }),
    undefined,
  );
});
