import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";

import { buildIndexes } from "../src/index-builder.ts";
import { collectSourceSnapshot } from "../src/source-snapshot.ts";
import { createTargetKey } from "../src/target.ts";
import { dropSequences } from "./test-util.ts";

void test("builds range locators from ordered source snapshots", () => {
  const chapterPath = "/publication/chapter.md";
  const endPath = "/publication/end.md";
  const indexPath = "/publication/index.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span id="start" data-index="index.md?q=a!Apple|(end.md%23end#index"></span>'),
        chapterPath,
      ),
    ],
    [endPath, collectSourceSnapshot(fromHtml('<span id="end"></span>'), endPath)],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes, messages } = buildIndexes([chapterPath, endPath, indexPath], sources);
  const builtIndex = indexes.get(createTargetKey({ documentPath: indexPath, elementId: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(dropSequences(builtIndex.index), {
    children: [
      {
        key: { html: "a", reading: "a" },
        children: [
          {
            key: { html: "Apple", reading: "Apple" },
            children: [],
            locators: [
              {
                locator: {
                  start: "chapter.html#start",
                  end: "end.html#end",
                },
                important: false,
              },
            ],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  });
  assert.deepStrictEqual([...messages.values()], [[], [], []]);
});

void test("rejects reversed ranges while preserving source messages", () => {
  const endPath = "/publication/001.md";
  const chapterPath = "/publication/100.md";
  const indexPath = "/publication/index.md";
  const chapter = collectSourceSnapshot(
    fromHtml(
      '<span data-index="index.md?q=a!Apple|(001.md%23end#index"></span><span data-index="index.md?q=%5B#index"></span>',
    ),
    chapterPath,
  );
  const sources = new Map([
    [endPath, collectSourceSnapshot(fromHtml('<span id="end"></span>'), endPath)],
    [chapterPath, chapter],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes, messages } = buildIndexes([endPath, chapterPath, indexPath], sources);

  assert.strictEqual(indexes.size, 0);
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["instruction-parse-error", "range-end-order"],
  );
});

void test("reports unresolved references and targets outside the entry list", () => {
  const chapterPath = "/publication/chapter.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span data-index="outside.md?q=a!Apple|->b!Banana#index"></span>'),
        chapterPath,
      ),
    ],
  ]);

  const { messages } = buildIndexes([chapterPath], sources);

  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["invalid-reference", "target-not-in-entries"],
  );
});
