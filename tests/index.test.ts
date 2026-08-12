import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import unified from "unified";

import { defaultComparator, index, type FileSystem } from "../src/index.ts";

const entryProcessor = {
  processSync: ({ contents }: { contents: unknown }) => ({ toString: () => String(contents) }),
};

function createRoot(dataIndex?: string): hast.Root {
  return {
    type: "root",
    children:
      dataIndex === undefined
        ? []
        : [
            {
              type: "element",
              tagName: "nav",
              properties: { dataIndex },
              children: [],
            },
          ],
  };
}

void test("uses an injected file system to read entries and trigger updates", () => {
  const reads: string[] = [];
  const updates: string[] = [];
  const fileSystem: FileSystem = {
    readFileSync: (path) => {
      reads.push(path);
      return '<span data-index="$,[a,Apple]">Apple</span>';
    },
    touchSync: (path) => updates.push(path),
  };
  const processor = unified().use(index, {
    entryProcessor: entryProcessor as never,
    entryContext: "/publication",
    indexEntryMap: { "index.md": ["chapter.md"] },
    comparators: { $: defaultComparator("en") },
    fileSystem,
  });
  const indexRoot = createRoot("expand,$");

  processor.runSync(indexRoot, { path: "/publication/index.md" });
  processor.runSync(createRoot(), { path: "/publication/chapter.md" });

  assert.deepStrictEqual(reads, ["/publication/chapter.md"]);
  assert.deepStrictEqual(updates, ["/publication/index.md"]);
  const link = select(".index-main-entry-locators a", indexRoot);
  assert.ok(link);
  assert.strictEqual(getAttribute(link, "href"), "chapter.html#%2Fhtml%2Fbody%2Fspan");
});

void test("does not trigger an ignored update through the injected file system", () => {
  const updates: string[] = [];
  const fileSystem: FileSystem = {
    readFileSync: () => "",
    touchSync: (path) => updates.push(path),
  };
  const processor = unified().use(index, {
    entryProcessor: entryProcessor as never,
    entryContext: "/publication",
    indexEntryMap: {
      "index.md": [{ path: "chapter.md", ignoreUpdate: true }],
    },
    comparators: { $: defaultComparator("en") },
    fileSystem,
  });

  processor.runSync(createRoot(), { path: "/publication/chapter.md" });

  assert.deepStrictEqual(updates, []);
});

function createLocalizedIndexRoot(
  intermediateLocale?: string,
  indexLocale?: string,
  documentLocale: string | null = "en",
): hast.Root {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        properties: documentLocale === null ? {} : { lang: documentLocale },
        children: [
          {
            type: "element",
            tagName: "section",
            properties: intermediateLocale === undefined ? {} : { lang: intermediateLocale },
            children: [
              {
                type: "element",
                tagName: "nav",
                properties:
                  indexLocale === undefined
                    ? { dataIndex: "expand,$" }
                    : { dataIndex: "expand,$", lang: indexLocale },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function createLocalizedProcessor(
  comparators?: Parameters<typeof index>[0]["comparators"],
  contents = '<span data-index="$,[z,Z]">Z</span><span data-index="$,[ä,Ä]">Ä</span>',
) {
  return unified().use(index, {
    entryProcessor: entryProcessor as never,
    entryContext: "/publication",
    indexEntryMap: { "index.md": ["chapter.md"] },
    ...(comparators === undefined ? {} : { comparators }),
    fileSystem: {
      readFileSync: () => contents,
      touchSync: () => {},
    },
  });
}

function getGroupHeadings(root: hast.Root | hast.Element) {
  return selectAll("li.index-group", root).map((group) => toText(group).slice(0, 1));
}

void test("an intermediate language overrides the document language", () => {
  const documentLanguageRoot = createLocalizedIndexRoot();
  const intermediateLanguageRoot = createLocalizedIndexRoot("sv");

  createLocalizedProcessor().runSync(documentLanguageRoot, { path: "/publication/index.md" });
  createLocalizedProcessor().runSync(intermediateLanguageRoot, {
    path: "/publication/index.md",
  });

  assert.deepStrictEqual(getGroupHeadings(documentLanguageRoot), ["ä", "z"]);
  assert.deepStrictEqual(getGroupHeadings(intermediateLanguageRoot), ["z", "ä"]);
});

void test("prefers a configured index comparator over the closest ancestor language", () => {
  const root = createLocalizedIndexRoot("not_a_locale");

  createLocalizedProcessor({ $: defaultComparator("en") }).runSync(root, {
    path: "/publication/index.md",
  });

  assert.deepStrictEqual(getGroupHeadings(root), ["ä", "z"]);
});

void test("the index element language overrides its ancestor language", () => {
  const root = createLocalizedIndexRoot("sv", "en");

  createLocalizedProcessor({}).runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(getGroupHeadings(root), ["ä", "z"]);
});

void test("uses the runtime default language when no language is specified", () => {
  const root = createLocalizedIndexRoot(undefined, undefined, null);
  const collator = new Intl.Collator();
  const expected = ["z", "ä"].sort((a, b) => collator.compare(a, b));

  createLocalizedProcessor({}).runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(getGroupHeadings(root), expected);
});

void test("sorts repeated expansions of an index with their respective languages", () => {
  const root: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [
          {
            type: "element",
            tagName: "section",
            properties: { lang: "en" },
            children: [
              {
                type: "element",
                tagName: "nav",
                properties: { dataIndex: "expand,$" },
                children: [],
              },
            ],
          },
          {
            type: "element",
            tagName: "section",
            properties: { lang: "sv" },
            children: [
              {
                type: "element",
                tagName: "nav",
                properties: { dataIndex: "expand,$" },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  createLocalizedProcessor({}).runSync(root, { path: "/publication/index.md" });

  const expansions = selectAll("nav", root);
  assert.deepStrictEqual(getGroupHeadings(expansions[0]!), ["ä", "z"]);
  assert.deepStrictEqual(getGroupHeadings(expansions[1]!), ["z", "ä"]);
});

void test("does not apply a fallback comparator to an unexpanded index", () => {
  const root = createLocalizedIndexRoot("not_a_locale");
  const contents = [
    '<span data-index="$,[z,Z]">Z</span>',
    '<span data-index="$,[ä,Ä]">Ä</span>',
    '<span data-index="x,[z,Z]">Z</span>',
    '<span data-index="x,[ä,Ä]">Ä</span>',
  ].join("");

  createLocalizedProcessor({ $: defaultComparator("en") }, contents).runSync(root, {
    path: "/publication/index.md",
  });

  assert.deepStrictEqual(getGroupHeadings(root), ["ä", "z"]);
});

void test("does not create a comparator for a missing index", () => {
  const root = createLocalizedIndexRoot("not_a_locale");
  const expansion = select("nav", root);
  assert.ok(expansion);
  expansion.properties = { ...expansion.properties, dataIndex: "expand,missing" };

  createLocalizedProcessor({}).runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(expansion.children, []);
});
