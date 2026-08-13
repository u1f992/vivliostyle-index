import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";
import { selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import VFile from "vfile";

import { renderDocumentIndexes } from "../src/document-renderer.ts";
import type { BuiltIndex } from "../src/index-builder.ts";
import { defaultComparator } from "../src/sort.ts";
import type { Index } from "../src/model.ts";
import { createTargetKey } from "../src/target.ts";

function createIndex(): Index {
  return {
    children: ["z", "a"].map((reading) => ({
      key: { html: reading, reading },
      children: [
        {
          key: { html: reading.toUpperCase(), reading },
          children: [],
          locators: [],
          see: [],
          seeAlso: [],
        },
      ],
    })),
  };
}

void test("renders indexes into targets in the current document", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, id: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePath: "/publication/chapter.md",
  };
  const root = fromHtml('<nav id="index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.deepStrictEqual(
    selectAll("li.index-group", root).map((group) => toText(group).slice(0, 1)),
    ["a", "z"],
  );
  assert.strictEqual(file.messages.length, 0);
});

void test("renders into a target whose ID requires CSS escaping", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, id: "index/main" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePath: "/publication/chapter.md",
  };
  const root = fromHtml('<nav id="index/main"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.strictEqual(selectAll("li.index-group", root).length, 2);
  assert.strictEqual(file.messages.length, 0);
});

void test("uses a comparator configured for the target", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, id: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePath: "/publication/chapter.md",
  };
  const comparator = defaultComparator("en");
  const reverseComparator = {
    ...comparator,
    group: (left: Index["children"][number], right: Index["children"][number]) =>
      -comparator.group(left, right),
  };
  const root = fromHtml('<nav id="index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([[targetKey, reverseComparator]]),
    file,
  );

  assert.deepStrictEqual(
    selectAll("li.index-group", root).map((group) => toText(group).slice(0, 1)),
    ["z", "a"],
  );
});

void test("reports a missing target", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, id: "missing" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePath: "/publication/chapter.md",
  };
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    fromHtml('<nav id="index"></nav>'),
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map(),
    file,
  );

  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.ruleId, "missing-index-target");
});
