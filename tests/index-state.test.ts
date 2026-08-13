import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";

import type { FileSystem } from "../src/file-system.ts";
import { IndexState, type EntryProcessorInput } from "../src/index-state.ts";

const entryProcessor = {
  processSync: ({ contents }: { contents: unknown }) => ({ toString: () => String(contents) }),
};

void test("initializes once and rebuilds indexes after a source update", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const files = {
    [chapterPath]: '<span data-index="index.md?q=a!Apple#index"></span>',
    [indexPath]: '<nav id="index"></nav>',
  };
  const reads: string[] = [];
  const fileSystem: FileSystem = {
    readFileSync: (path) => {
      reads.push(path);
      return files[path as keyof typeof files];
    },
    touchSync: () => {},
  };
  const state = new IndexState([chapterPath, indexPath]);
  const createEntryProcessor = () => entryProcessor as never;

  state.initialize(fileSystem, createEntryProcessor);
  state.initialize(fileSystem, createEntryProcessor);
  const unchanged = state.update(chapterPath, fromHtml(files[chapterPath]));
  const affected = state.update(
    chapterPath,
    fromHtml('<span data-index="index.md?q=b!Banana#index"></span>'),
  );

  assert.deepStrictEqual(reads, [chapterPath, indexPath]);
  assert.deepStrictEqual([...unchanged], []);
  assert.deepStrictEqual([...affected], [indexPath]);
  assert.strictEqual(state.indexes.size, 1);
  assert.deepStrictEqual(state.messagesFor(chapterPath), []);
});

void test("marks range sources and index targets after an end document changes", () => {
  const chapterPath = "/publication/chapter.md";
  const endPath = "/publication/end.md";
  const indexPath = "/publication/index.md";
  const files = {
    [chapterPath]: '<span data-index="index.md?q=a!Apple|(end.md%23end#index"></span>',
    [endPath]: '<span id="end"></span>',
    [indexPath]: '<nav id="index"></nav>',
  };
  const fileSystem: FileSystem = {
    readFileSync: (path) => files[path as keyof typeof files],
    touchSync: () => {},
  };
  const state = new IndexState([chapterPath, endPath, indexPath]);

  state.initialize(fileSystem, () => entryProcessor as never);
  const affected = state.update(endPath, fromHtml(""));

  assert.deepStrictEqual([...affected], [chapterPath, indexPath]);
  assert.deepStrictEqual(
    state.messagesFor(chapterPath).map((message) => message[2]?.split(":")[1]),
    ["missing-range-end"],
  );
});

void test("names the entry and entryContext when an entry cannot be read", () => {
  const missingPath = "/elsewhere/chapter.md";
  const fileSystem: FileSystem = {
    readFileSync: () => {
      throw new Error("ENOENT");
    },
    touchSync: () => {},
  };
  const state = new IndexState([missingPath]);

  assert.throws(
    () => state.initialize(fileSystem, () => entryProcessor as never),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(missingPath) &&
      error.message.includes("entryContext") &&
      error.cause instanceof Error &&
      error.cause.message === "ENOENT",
  );
});

void test("keeps EntryProcessorInput properties mutable", () => {
  const input: EntryProcessorInput = { path: "chapter.md", contents: "before" };

  input.path = "next.md";
  input.contents = "after";

  assert.deepStrictEqual(input, { path: "next.md", contents: "after" });
});
