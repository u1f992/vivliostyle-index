import assert from "node:assert";
import test from "node:test";

import {
  ensureEntry,
  findUnresolvedReference,
  getChild,
  insertLocator,
  revokeVacantEntries,
  type Index,
  type Subentry,
} from "../src/model.ts";

const group = { html: "ち", reading: "ち" };
const intellectualProperty = { html: "知的財産権", reading: "ちてきざいさんけん" };
const patent = { html: "特許権", reading: "とっきょけん" };

function createIndexWithSubentry(locators: Subentry["locators"]): Index {
  return {
    children: [
      {
        key: group,
        children: [
          {
            key: intellectualProperty,
            children: [{ key: patent, locators, see: [], seeAlso: [] }],
            locators: [],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  };
}

function createIndex(): Index {
  return {
    children: [
      {
        key: group,
        children: [
          {
            key: intellectualProperty,
            children: [],
            locators: [],
            see: [],
            seeAlso: [],
          },
          {
            key: { html: "著作権", reading: "ちょさくけん" },
            children: [],
            locators: [],
            see: [],
            seeAlso: [
              {
                target: { group, entry: intellectualProperty },
              },
            ],
          },
        ],
      },
    ],
  };
}

void test("accepts references to registered entries", () => {
  assert.strictEqual(
    findUnresolvedReference(createIndex(), { group, entry: intellectualProperty }),
    undefined,
  );
});

void test("reports references to unregistered entries", () => {
  const entry = { html: "工業所有権", reading: "こうぎょうしょゆうけん" };

  assert.deepStrictEqual(findUnresolvedReference(createIndex(), { group, entry }), {
    target: { group, entry },
    missing: "entry",
  });
});

void test("reports a reference that uses different inner HTML", () => {
  const entry = { html: "<em>知的財産権</em>", reading: "ちてきざいさんけん" };

  assert.strictEqual(findUnresolvedReference(createIndex(), { group, entry })?.missing, "entry");
});

void test("reports a missing group before a missing heading", () => {
  assert.strictEqual(
    findUnresolvedReference(createIndex(), {
      group: { html: "こ", reading: "こ" },
      entry: intellectualProperty,
    })?.missing,
    "group",
  );
});

void test("reports a missing subentry of a registered heading", () => {
  assert.strictEqual(
    findUnresolvedReference(createIndex(), {
      group,
      entry: intellectualProperty,
      subentry: { html: "特許権", reading: "とっきょけん" },
    })?.missing,
    "subentry",
  );
});

void test("revokes headings that hold no locator or reference", () => {
  const index = createIndex();

  const revoked = revokeVacantEntries(index);

  assert.deepStrictEqual(
    index.children[0]?.children.map(({ key }) => key.html),
    ["著作権"],
  );
  assert.deepStrictEqual(revoked, [{ group, entry: intellectualProperty }]);
});

void test("keeps a heading that only carries subentries", () => {
  const index = createIndexWithSubentry([{ location: "chapter.html#a" }]);

  const revoked = revokeVacantEntries(index);

  assert.strictEqual(index.children[0]?.children.length, 1);
  assert.deepStrictEqual(revoked, []);
});

void test("revokes a group left without headings", () => {
  const index = createIndexWithSubentry([]);

  const revoked = revokeVacantEntries(index);

  assert.deepStrictEqual(index.children, []);
  assert.deepStrictEqual(revoked, [
    { group, entry: intellectualProperty, subentry: patent },
    { group, entry: intellectualProperty },
  ]);
});

void test("revokes only the locator that was inserted", () => {
  const index: Index = { children: [] };
  const intellectualPropertyEntry = ensureEntry(index, { group, entry: intellectualProperty });
  const locators = ["001.html#a", "002.html#b", "003.html#c"].map((location) => ({
    location,
  }));
  const revocations = locators.map((locator) => insertLocator(intellectualPropertyEntry, locator));

  revocations[0]?.();

  assert.deepStrictEqual(
    intellectualPropertyEntry.locators.map(({ location }) => location),
    ["002.html#b", "003.html#c"],
  );
});

void test("distinguishes headings that share HTML but not their reading", () => {
  const index: Index = { children: [] };
  const first = { html: "One", reading: "ichi" };
  const second = { html: "One", reading: "hitotsu" };

  ensureEntry(index, { group, entry: first });
  ensureEntry(index, { group, entry: second });

  assert.deepStrictEqual(
    index.children[0]?.children.map(({ key }) => key.reading),
    ["ichi", "hitotsu"],
  );
  assert.strictEqual(getChild(index.children[0]!, { html: "One", reading: "san" }), undefined);
});

void test("revokes an inserted locator only once", () => {
  const index: Index = { children: [] };
  const intellectualPropertyEntry = ensureEntry(index, { group, entry: intellectualProperty });
  const input = { location: "001.html#a" };
  const revoke = insertLocator(intellectualPropertyEntry, input);
  insertLocator(intellectualPropertyEntry, input);

  revoke();
  revoke();

  assert.strictEqual(intellectualPropertyEntry.locators.length, 1);
});
