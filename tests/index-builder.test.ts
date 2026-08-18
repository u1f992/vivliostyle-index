import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";

import { buildIndexes } from "../src/index-builder.ts";
import { collectSourceSnapshot } from "../src/source-snapshot.ts";
import { createTargetKey } from "../src/target.ts";
import { identityTemplate } from "../src/template.ts";

void test("builds range locators from ordered source snapshots", () => {
  const chapterPath = "/publication/chapter.md";
  const endPath = "/publication/end.md";
  const indexPath = "/publication/index.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span id="start" data-index="index.md?q=a!Apple|(#index"></span>'),
        chapterPath,
      ),
    ],
    [
      endPath,
      collectSourceSnapshot(
        fromHtml('<span id="end" data-index="index.md?q=a!Apple|)#index"></span>'),
        endPath,
      ),
    ],
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
                  type: "range",
                  start: "chapter.html#start",
                  end: "end.html#end",
                },
                template: identityTemplate,
              },
            ],
            xrefPreferred: [],
            xrefRelated: [],
          },
        ],
      },
    ],
  });
  assert.deepStrictEqual([...messages.values()], [[], [], []]);
});

void test("degrades range markers that precede their starts to page locators", () => {
  const endPath = "/publication/001.md";
  const chapterPath = "/publication/100.md";
  const indexPath = "/publication/index.md";
  const chapter = collectSourceSnapshot(
    fromHtml(
      '<span data-index="index.md?q=a!Apple|(#index"></span><span data-index="index.md?q=%5B#index"></span>',
    ),
    chapterPath,
  );
  const sources = new Map([
    [
      endPath,
      collectSourceSnapshot(
        fromHtml('<span id="end" data-index="index.md?q=a!Apple|)#index"></span>'),
        endPath,
      ),
    ],
    [chapterPath, chapter],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes, messages } = buildIndexes([endPath, chapterPath, indexPath], sources);
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(
    builtIndex.index.children[0]?.children[0]?.locators.map(({ location }) => location),
    [
      { type: "page", href: "001.html#end" },
      { type: "page", href: "100.html#index.source.L2h0bWwvYm9keS9zcGFuWzFd" },
    ],
  );
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["instruction-parse-error", "unmatched-range-start"],
  );
  assert.deepStrictEqual(
    messages.get(endPath)?.map((message) => message[2]?.split(":")[1]),
    ["unmatched-range-end"],
  );
});

void test("reports unresolved cross-references and targets outside the entry list", () => {
  const chapterPath = "/publication/chapter.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span data-index="outside.md?q=a!Apple|see{b!Banana}#index"></span>'),
        chapterPath,
      ),
    ],
  ]);

  const { indexes, messages } = buildIndexes([chapterPath], sources);
  const builtIndex = indexes.get(createTargetKey({ path: "/publication/outside.md", id: "index" }));

  assert.strictEqual(builtIndex?.index.children[0]?.children[0]?.xrefPreferred.length, 1);
  assert.strictEqual(
    builtIndex?.index.children[0]?.children[0]?.xrefPreferred[0]?.error,
    "invalid-xref",
  );
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["invalid-xref", "target-not-in-entries"],
  );
});

void test("degrades a range start whose end lies outside the entry list", () => {
  const chapterPath = "/publication/chapter.md";
  const endPath = "/publication/end.md";
  const indexPath = "/publication/index.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span id="start" data-index="index.md?q=a!Apple|(#index"></span>'),
        chapterPath,
      ),
    ],
    [
      endPath,
      collectSourceSnapshot(
        fromHtml('<span id="end" data-index="index.md?q=a!Apple|)#index"></span>'),
        endPath,
      ),
    ],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes, messages } = buildIndexes([chapterPath, indexPath], sources);
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(
    builtIndex.index.children[0]?.children[0]?.locators.map(({ location }) => location),
    [{ type: "page", href: "chapter.html#start" }],
  );
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["unmatched-range-start"],
  );
  assert.deepStrictEqual(messages.get(indexPath), []);
  assert.deepStrictEqual(
    messages.get(endPath)?.map((message) => message[2]?.split(":")[1]),
    ["document-not-in-entries"],
  );
});

void test("degrades a range start when its end is in an unprocessed document", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const sources = new Map([
    [
      chapterPath,
      collectSourceSnapshot(
        fromHtml('<span id="start" data-index="index.md?q=a!Apple|(#index"></span>'),
        chapterPath,
      ),
    ],
    [indexPath, collectSourceSnapshot(fromHtml('<nav id="index"></nav>'), indexPath)],
  ]);

  const { indexes, messages } = buildIndexes([chapterPath, indexPath], sources);
  const builtIndex = indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.ok(builtIndex);
  assert.deepStrictEqual(
    builtIndex.index.children[0]?.children[0]?.locators.map(({ location }) => location),
    [{ type: "page", href: "chapter.html#start" }],
  );
  assert.deepStrictEqual(
    messages.get(chapterPath)?.map((message) => message[2]?.split(":")[1]),
    ["unmatched-range-start"],
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
        fromHtml('<span data-index="index.md?q=b!Banana|see{c!Cherry}#index"></span>'),
        brokenPath,
      ),
    ],
  ]);

  const { messages } = buildIndexes([soundPath, brokenPath], sources);

  assert.deepStrictEqual(
    messages.get(soundPath)?.map((message) => message[2]?.split(":")[1]),
    ["target-not-in-entries"],
  );
  assert.deepStrictEqual(
    messages.get(brokenPath)?.map((message) => message[2]?.split(":")[1]),
    ["invalid-xref", "target-not-in-entries"],
  );
});

void test("builds locators and cross-references in the order the sources list them", () => {
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
            '<span data-index="index.md?q=a!Apple|seealso{z!Zebra}#index"></span>',
            '<span data-index="index.md?q=a!Apple|seealso{b!Banana}#index"></span>',
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
    [
      { type: "page", href: "chapter.html#second" },
      { type: "page", href: "chapter.html#first" },
    ],
  );
  assert.deepStrictEqual(
    apple?.xrefRelated.map(({ target }) => target.entry.html),
    ["Zebra", "Banana"],
  );
});
