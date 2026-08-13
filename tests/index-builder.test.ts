import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";

import { buildIndexes } from "../src/index-builder.ts";
import { collectSourceSnapshot } from "../src/source-snapshot.ts";
import { createTargetKey } from "../src/target.ts";

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
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(builtIndex.index, {
    children: [
      {
        key: { html: "a", reading: "a" },
        children: [
          {
            key: { html: "Apple", reading: "Apple" },
            children: [],
            locators: [
              {
                location: {
                  start: "chapter.html#start",
                  end: "end.html#end",
                },
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

void test("revokes reversed ranges while preserving source messages", () => {
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
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(builtIndex.index.children, []);
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
    ["invalid-reference", "vacant-entry", "target-not-in-entries"],
  );
});

void test("revokes a range whose end lies outside the entry list", () => {
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

  const { indexes, messages } = buildIndexes([chapterPath, indexPath], sources);
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(builtIndex.index.children, []);
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["range-end-not-in-entries"],
  );
  assert.deepStrictEqual(
    messages.get(indexPath)?.map((message) => message[2]?.split(":")[1]),
    ["vacant-entry"],
  );
});

void test("reports instructions carried by a document outside the entry list", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span data-index="index.md?q=a!Apple#index"></span>'),
        chapterPath,
      ),
    ],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes, messages } = buildIndexes([indexPath], sources);

  assert.strictEqual(indexes.size, 0);
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["document-not-in-entries"],
  );
});

void test("reports index-wide diagnostics to every document naming a target outside the entry list", () => {
  const soundPath = "/publication/one.md";
  const brokenPath = "/publication/two.md";
  const sources = new Map([
    [
      soundPath,
      collectSourceSnapshot(
        fromHtml('<span data-index="index.md?q=a!Apple#index"></span>'),
        soundPath,
      ),
    ],
    [
      brokenPath,
      collectSourceSnapshot(
        fromHtml('<span data-index="index.md?q=b!Banana|->c!Cherry#index"></span>'),
        brokenPath,
      ),
    ],
  ]);

  const { messages } = buildIndexes([soundPath, brokenPath], sources);

  assert.deepStrictEqual(
    messages.get(soundPath)?.map((message) => message[2]?.split(":")[1]),
    ["vacant-entry", "target-not-in-entries"],
  );
  assert.deepStrictEqual(
    messages.get(brokenPath)?.map((message) => message[2]?.split(":")[1]),
    ["invalid-reference", "vacant-entry", "target-not-in-entries"],
  );
});

void test("builds locators and references in the order the sources list them", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml(
          [
            '<span id="second" data-index="index.md?q=a!Apple#index"></span>',
            '<span id="first" data-index="index.md?q=a!Apple#index"></span>',
            '<span data-index="index.md?q=a!Apple|=>z!Zebra#index"></span>',
            '<span data-index="index.md?q=a!Apple|=>b!Banana#index"></span>',
            '<span data-index="index.md?q=z!Zebra#index"></span>',
            '<span data-index="index.md?q=b!Banana#index"></span>',
          ].join(""),
        ),
        chapterPath,
      ),
    ],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes } = buildIndexes([indexPath, chapterPath], sources);
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));
  const apple = builtIndex?.index.children[0]?.children[0];

  assert.deepStrictEqual(
    apple?.locators.map(({ location }) => location),
    ["chapter.html#second", "chapter.html#first"],
  );
  assert.deepStrictEqual(
    apple?.seeAlso.map(({ target }) => target.entry.html),
    ["Zebra", "Banana"],
  );
});
