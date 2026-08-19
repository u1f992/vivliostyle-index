import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import VFile from "vfile";

import { renderDocumentIndexes } from "../src/document-renderer.ts";
import type { BuiltIndex } from "../src/index-builder.ts";
import type { CreateRenderer } from "../src/render.ts";
import { defaultComparator } from "../src/sort.ts";
import { createKey, type Index } from "../src/model.ts";
import { createTargetKey } from "../src/target.ts";

function createIndex(): Index {
  return {
    groups: ["z", "a"].map((reading) => ({
      key: createKey(reading, reading),
      entries: [
        {
          key: createKey(reading, reading.toUpperCase()),
          subentries: [],
          locators: [],
          xrefPreferred: [],
          xrefRelated: [],
        },
      ],
    })),
  };
}

void test("renders indexes into targets in the current document", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const root = fromHtml('<nav id="index" role="doc-index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.deepStrictEqual(
    selectAll("#index > div > section", root).map((group) => toText(group).slice(0, 1)),
    ["a", "z"],
  );
  assert.strictEqual(file.messages.length, 0);
});

void test("renders into a target whose ID requires CSS escaping", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index/main" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const root = fromHtml('<nav id="index/main" role="doc-index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.strictEqual(selectAll('[id="index/main"] > div > section', root).length, 2);
  assert.strictEqual(file.messages.length, 0);
});

void test("uses a comparator configured for the target", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const comparator = defaultComparator("en");
  const reverseComparator = {
    ...comparator,
    group: (left: Index["groups"][number], right: Index["groups"][number]) =>
      -comparator.group(left, right),
  };
  const root = fromHtml('<nav id="index" role="doc-index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([[targetKey, { comparator: () => reverseComparator }]]),
    file,
  );

  assert.deepStrictEqual(
    selectAll("#index > div > section", root).map((group) => toText(group).slice(0, 1)),
    ["z", "a"],
  );
});

void test("uses a renderer configured for the target", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const createRenderer: CreateRenderer = ({ h }) => ({
    groupList: {
      group: () => ({ heading: ({ contents }) => [h("h2", contents)] }),
    },
  });
  const root = fromHtml('<nav id="index" role="doc-index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([[targetKey, { renderer: createRenderer }]]),
    file,
  );

  assert.deepStrictEqual(
    selectAll("#index > div > section > h2", root).map((heading) => toText(heading)),
    ["a", "z"],
  );
  assert.deepStrictEqual(
    selectAll("#index > div > section > ul > li > span", root).map((heading) => toText(heading)),
    ["A", "Z"],
  );
  assert.strictEqual(file.messages.length, 0);
});

void test("reports a missing target", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "missing" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    fromHtml('<nav id="index" role="doc-index"></nav>'),
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map(),
    file,
  );

  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.ruleId, "missing-index-target");
});

void test("refuses a target without a role attribute", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const root = fromHtml('<nav id="index">placeholder</nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.ruleId, "missing-index-role");
  const element = select("#index", root);
  assert.ok(element);
  assert.strictEqual(toText(element), "placeholder");
  assert.strictEqual(element.data?.indexResult, undefined);
});

void test("refuses a target whose role lacks the doc-index token", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const root = fromHtml('<nav id="index" role="navigation doc-pagelist"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.ruleId, "missing-index-role");
  assert.strictEqual(selectAll("#index > div", root).length, 0);
});

void test("accepts a target carrying doc-index among other role tokens", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const root = fromHtml('<nav id="index" role="navigation  doc-index"></nav>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(root, documentPath, new Map([[targetKey, builtIndex]]), new Map(), file);

  assert.strictEqual(selectAll("#index > div > section", root).length, 2);
  assert.strictEqual(file.messages.length, 0);
});

void test("exposes the sorted index on the target element", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const root = fromHtml('<nav id="index" role="doc-index"></nav>');

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map(),
    VFile({ path: documentPath }),
  );

  const element = select("#index", root);
  assert.ok(element);
  const payload = element.data?.indexResult as Index;
  assert.deepStrictEqual(
    payload.groups.map(({ key }) => key.reading),
    ["a", "z"],
  );
});

void test("reports a language the runtime cannot sort by", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const requestedLocales: Intl.LocalesArgument[] = [];
  const root = fromHtml('<section lang="en_US"><nav id="index" role="doc-index"></nav></section>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([
      [
        targetKey,
        {
          comparator: (locales: Intl.LocalesArgument) => {
            requestedLocales.push(locales);
            return defaultComparator(locales);
          },
        },
      ],
    ]),
    file,
  );

  assert.deepStrictEqual(requestedLocales, ["en"]);
  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["unsupported-language"],
  );
  assert.deepStrictEqual(
    selectAll("#index > div > section", root).map((group) => toText(group).slice(0, 1)),
    ["a", "z"],
  );
});

void test("takes an empty language as no language at all", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const requestedLocales: Intl.LocalesArgument[] = [];
  const root = fromHtml('<section lang=""><nav id="index" role="doc-index"></nav></section>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([
      [
        targetKey,
        {
          comparator: (locales: Intl.LocalesArgument) => {
            requestedLocales.push(locales);
            return defaultComparator(locales);
          },
        },
      ],
    ]),
    file,
  );

  assert.deepStrictEqual(requestedLocales, ["en"]);
  assert.deepStrictEqual(file.messages, []);
});

void test("reports a language the runtime has no collation for", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const requestedLocales: Intl.LocalesArgument[] = [];
  const root = fromHtml('<section lang="jp"><nav id="index" role="doc-index"></nav></section>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([
      [
        targetKey,
        {
          comparator: (locales: Intl.LocalesArgument) => {
            requestedLocales.push(locales);
            return defaultComparator(locales);
          },
        },
      ],
    ]),
    file,
  );

  assert.deepStrictEqual(requestedLocales, ["en"]);
  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["unsupported-language"],
  );
});

void test("keeps a language the runtime can collate", () => {
  const documentPath = "/publication/index.md";
  const target = { path: documentPath, fragment: "index" };
  const targetKey = createTargetKey(target);
  const builtIndex: BuiltIndex = {
    target,
    index: createIndex(),
    sourcePaths: ["/publication/chapter.md"],
  };
  const requestedLocales: Intl.LocalesArgument[] = [];
  const root = fromHtml('<section lang="sv"><nav id="index" role="doc-index"></nav></section>');
  const file = VFile({ path: documentPath });

  renderDocumentIndexes(
    root,
    documentPath,
    new Map([[targetKey, builtIndex]]),
    new Map([
      [
        targetKey,
        {
          comparator: (locales: Intl.LocalesArgument) => {
            requestedLocales.push(locales);
            return defaultComparator(locales);
          },
        },
      ],
    ]),
    file,
  );

  assert.deepStrictEqual(requestedLocales, ["sv"]);
  assert.deepStrictEqual(file.messages, []);
});
