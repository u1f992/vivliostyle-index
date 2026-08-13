import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";

import type { Index } from "../src/model.ts";
import { renderIndex } from "../src/render.ts";

const index: Index = {
  children: [
    {
      key: { html: "ち", reading: "ち" },
      children: [
        {
          key: { html: "著作権", reading: "ちょさくけん" },
          children: [],
          locators: [{ locator: "003.html#a" }],
          see: [],
          seeAlso: [],
        },
      ],
    },
    {
      key: { html: "そ", reading: "そ" },
      children: [
        {
          key: { html: "相続", reading: "そうぞく" },
          children: [],
          locators: [{ locator: "088.html#b" }],
          see: [],
          seeAlso: [],
        },
      ],
    },
  ],
};

const GROUP = "#index > ol > li";
const MAIN_ENTRY = `${GROUP} > ol > li`;
const LOCATORS = `${MAIN_ENTRY} > ol:nth-of-type(1)`;
const SUBENTRY = `${MAIN_ENTRY} > ol:nth-of-type(4) > li`;
const SUBENTRY_LOCATORS = `${SUBENTRY} > ol:nth-of-type(1)`;

function createTarget(): hast.Element {
  return {
    type: "element",
    tagName: "nav",
    properties: { id: "index" },
    children: [],
  };
}

function rootOf(target: hast.Element): hast.Root {
  return { type: "root", children: [target] };
}

void test("renders an index into the target element", () => {
  const target = createTarget();

  renderIndex(index, target, "index");

  const entry = select(MAIN_ENTRY, rootOf(target));
  assert.ok(entry);
  assert.ok(getAttribute(entry, "id")?.startsWith("index--"));
});

void test("wraps every key in an element of its own", () => {
  const target = createTarget();
  const indexWithSubentry: Index = {
    children: [
      {
        key: { html: "そ", reading: "そ" },
        children: [
          {
            key: { html: "相続", reading: "そうぞく" },
            children: [
              {
                key: { html: "一身専属", reading: "いっしんせんぞく" },
                locators: [{ locator: "076.html#c" }],
                see: [],
                seeAlso: [],
              },
            ],
            locators: [{ locator: "088.html#b" }],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithSubentry, target, "index");

  assert.deepStrictEqual(
    selectAll(`${GROUP} > span`, rootOf(target)).map((key) => toText(key)),
    ["そ"],
  );
  assert.deepStrictEqual(
    selectAll(`${MAIN_ENTRY} > span`, rootOf(target)).map((key) => toText(key)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span`, rootOf(target)).map((key) => toText(key)),
    ["一身専属"],
  );
});

function listChildren(element: hast.Element): number {
  return element.children.filter((child) => child.type === "element" && child.tagName === "ol")
    .length;
}

void test("gives every entry the same lists in the same order", () => {
  const target = createTarget();
  const indexWithEveryList: Index = {
    children: [
      {
        key: { html: "あ", reading: "あ" },
        children: [
          {
            key: { html: "A", reading: "あ" },
            locators: [{ locator: "001.html#a" }],
            see: [
              {
                target: {
                  group: { html: "い", reading: "い" },
                  mainEntry: { html: "B", reading: "び" },
                },
              },
            ],
            seeAlso: [
              {
                target: {
                  group: { html: "う", reading: "う" },
                  mainEntry: { html: "C", reading: "し" },
                },
              },
            ],
            children: [
              {
                key: { html: "D", reading: "でぃ" },
                locators: [],
                see: [],
                seeAlso: [],
              },
            ],
          },
        ],
      },
      {
        key: { html: "え", reading: "え" },
        children: [
          {
            key: { html: "E", reading: "い" },
            locators: [{ locator: "002.html#b" }],
            see: [],
            seeAlso: [],
            children: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithEveryList, target, "index");
  const root = rootOf(target);

  assert.deepStrictEqual(selectAll(MAIN_ENTRY, root).map(listChildren), [4, 4]);
  assert.deepStrictEqual(selectAll(SUBENTRY, root).map(listChildren), [3]);
  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > a`, root).map((link) => getAttribute(link, "href")),
    ["001.html#a", "002.html#b"],
  );
  assert.deepStrictEqual(
    selectAll(`${MAIN_ENTRY} > ol:nth-of-type(2) > li > a`, root).map((link) => toText(link)),
    ["B"],
  );
  assert.deepStrictEqual(
    selectAll(`${MAIN_ENTRY} > ol:nth-of-type(3) > li > a`, root).map((link) => toText(link)),
    ["C"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span`, root).map((key) => toText(key)),
    ["D"],
  );
});

void test("wraps a locator in the template of its instruction", () => {
  const target = createTarget();
  const indexWithTemplate: Index = {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            locators: [
              { locator: "104.html#a", template: "<strong><slot></slot></strong>" },
              { locator: "112.html#b" },
            ],
            see: [],
            seeAlso: [],
            children: [
              {
                key: { html: "私的複製", reading: "してきふくせい" },
                locators: [{ locator: "106.html#c", template: "<em><slot></slot></em>" }],
                see: [],
                seeAlso: [],
              },
            ],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithTemplate, target, "index");

  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > strong > a`, rootOf(target)).map((link) =>
      getAttribute(link, "href"),
    ),
    ["104.html#a"],
  );
  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > a`, rootOf(target)).map((link) => getAttribute(link, "href")),
    ["112.html#b"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY_LOCATORS} > li > em > a`, rootOf(target)).map((link) =>
      getAttribute(link, "href"),
    ),
    ["106.html#c"],
  );
});

void test("exposes the rendered index as JSON on the target element", () => {
  const target = createTarget();
  const root: hast.Root = { type: "root", children: [target] };

  renderIndex(index, target, "index");

  assert.deepStrictEqual(selectAll("[data-index-result]", root), [target]);
  assert.strictEqual(getAttribute(target, "data-index-result"), JSON.stringify(index));
});

void test("keeps an index instruction carried by the target element itself", () => {
  const instruction = "index.md?q=さ!索引#index";
  const target = createTarget();
  target.properties = { ...target.properties, dataIndex: instruction };

  renderIndex(index, target, "index");

  assert.strictEqual(getAttribute(target, "data-index"), instruction);
});

void test("exposes an emptied index on the target element", () => {
  const target = createTarget();

  renderIndex({ children: [] }, target, "index");

  assert.deepStrictEqual(target.children, []);
  assert.strictEqual(getAttribute(target, "data-index-result"), '{"children":[]}');
});
