import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";

import { run, test as testCommand } from "./command.js";
import insertPage from "./command/insert-page.js";
import type { Index, Key } from "./model.js";

const input = "$,[R,RPA]";

function createLocator(relPath: string | null, id?: string) {
  const elem: hast.Element = {
    type: "element",
    tagName: "span",
    properties: id === undefined ? {} : { id },
    children: [{ type: "text", value: "RPA" }],
  };
  const tree: hast.Root = { type: "root", children: [elem] };
  const indexes: Index<Key>[] = [];

  assert.ok(testCommand(insertPage, input));
  run(insertPage, input, indexes, tree, elem, relPath);

  const [index] = indexes;
  assert.ok(index);
  const [group] = index.children;
  assert.ok(group);
  const [mainEntry] = group.children;
  assert.ok(mainEntry);
  const [locator] = mainEntry.locators;
  assert.ok(locator);

  return locator[1];
}

void test("encodes a non-ASCII relative path and XPath fragment", () => {
  assert.strictEqual(
    createLocator("01-日本語.html"),
    "01-%E6%97%A5%E6%9C%AC%E8%AA%9E.html#%2Fspan",
  );
});

void test("encodes each relative path segment", () => {
  assert.strictEqual(createLocator("../章 #1.html"), "../%E7%AB%A0%20%231.html#%2Fspan");
});

void test("encodes a non-ASCII element ID", () => {
  assert.strictEqual(
    createLocator("chapter.html", "索引語"),
    "chapter.html#%E7%B4%A2%E5%BC%95%E8%AA%9E",
  );
});

void test("creates a fragment-only URL for the same document", () => {
  assert.strictEqual(createLocator(null), "#%2Fspan");
});
