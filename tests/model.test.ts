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
                target: { group, mainEntry: intellectualProperty },
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
    findUnresolvedReference(createIndex(), { group, mainEntry: intellectualProperty }),
    undefined,
  );
});

void test("reports references to unregistered entries", () => {
  const mainEntry = { html: "工業所有権", reading: "こうぎょうしょゆうけん" };

  assert.deepStrictEqual(findUnresolvedReference(createIndex(), { group, mainEntry }), {
    target: { group, mainEntry },
    missing: "mainEntry",
  });
});

void test("reports a reference that uses different inner HTML", () => {
  const mainEntry = { html: "<em>知的財産権</em>", reading: "ちてきざいさんけん" };

  assert.strictEqual(
    findUnresolvedReference(createIndex(), { group, mainEntry })?.missing,
    "mainEntry",
  );
});

void test("reports a missing group before a missing heading", () => {
  assert.strictEqual(
    findUnresolvedReference(createIndex(), {
      group: { html: "こ", reading: "こ" },
      mainEntry: intellectualProperty,
    })?.missing,
    "group",
  );
});

void test("reports a missing subentry of a registered heading", () => {
  assert.strictEqual(
    findUnresolvedReference(createIndex(), {
      group,
      mainEntry: intellectualProperty,
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
  assert.deepStrictEqual(revoked, [{ group, mainEntry: intellectualProperty }]);
});

void test("keeps a heading that only carries subentries", () => {
  const index = createIndexWithSubentry([{ locator: "chapter.html#a" }]);

  const revoked = revokeVacantEntries(index);

  assert.strictEqual(index.children[0]?.children.length, 1);
  assert.deepStrictEqual(revoked, []);
});

void test("revokes a group left without headings", () => {
  const index = createIndexWithSubentry([]);

  const revoked = revokeVacantEntries(index);

  assert.deepStrictEqual(index.children, []);
  assert.deepStrictEqual(revoked, [
    { group, mainEntry: intellectualProperty, subentry: patent },
    { group, mainEntry: intellectualProperty },
  ]);
});

void test("revokes only the locator that was inserted", () => {
  const index: Index = { children: [] };
  const entry = ensureEntry(index, { group, mainEntry: intellectualProperty });
  const locators = ["001.html#a", "002.html#b", "003.html#c"].map((locator) => ({
    locator,
  }));
  const revocations = locators.map((locator) => insertLocator(entry, locator));

  revocations[0]?.();

  assert.deepStrictEqual(
    entry.locators.map(({ locator }) => locator),
    ["002.html#b", "003.html#c"],
  );
});

void test("distinguishes headings that share HTML but not their reading", () => {
  const index: Index = { children: [] };
  const first = { html: "One", reading: "ichi" };
  const second = { html: "One", reading: "hitotsu" };

  ensureEntry(index, { group, mainEntry: first });
  ensureEntry(index, { group, mainEntry: second });

  assert.deepStrictEqual(
    index.children[0]?.children.map(({ key }) => key.reading),
    ["ichi", "hitotsu"],
  );
  assert.strictEqual(getChild(index.children[0]!, { html: "One", reading: "san" }), undefined);
});

void test("revokes an inserted locator only once", () => {
  const index: Index = { children: [] };
  const entry = ensureEntry(index, { group, mainEntry: intellectualProperty });
  const input = { locator: "001.html#a" };
  const revoke = insertLocator(entry, input);
  insertLocator(entry, input);

  revoke();
  revoke();

  assert.strictEqual(entry.locators.length, 1);
});
