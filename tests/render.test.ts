import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";

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
          locators: [{ locator: "003.html#a", important: false }],
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
          locators: [{ locator: "088.html#b", important: false }],
          see: [],
          seeAlso: [],
        },
      ],
    },
  ],
};

function createTarget(): hast.Element {
  return {
    type: "element",
    tagName: "nav",
    properties: { id: "index" },
    children: [],
  };
}

void test("renders an index into the target element", () => {
  const target = createTarget();

  renderIndex(index, target, "index");

  const entry = select(".index-main-entry", target);
  assert.ok(entry);
  assert.ok(getAttribute(entry, "id")?.startsWith("index--"));
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
