import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select } from "hast-util-select";
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
