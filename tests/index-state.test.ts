import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";

import type { FileSystem } from "../src/file-system.ts";
import {
  createIndexState,
  initializeIndexState,
  messagesFor,
  updateIndexState,
  type EntryProcessorInput,
  type IndexState,
} from "../src/index-state.ts";
import { createTargetKey } from "../src/target.ts";

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
  const createEntryProcessor = () => entryProcessor as never;

  const initialized = initializeIndexState(
    createIndexState([chapterPath, indexPath]),
    fileSystem,
    createEntryProcessor,
  );
  const again = initializeIndexState(initialized, fileSystem, createEntryProcessor);
  const unchanged = updateIndexState(initialized, chapterPath, fromHtml(files[chapterPath]));
  const affected = updateIndexState(
    unchanged.state,
    chapterPath,
    fromHtml('<span data-index="index.md?q=b!Banana#index"></span>'),
  );

  assert.strictEqual(again, initialized);
  assert.deepStrictEqual(reads, [chapterPath, indexPath]);
  assert.deepStrictEqual([...unchanged.affectedPaths], []);
  assert.strictEqual(unchanged.entryProcessorMismatch, false);
  assert.deepStrictEqual([...affected.affectedPaths], [indexPath]);
  assert.strictEqual(affected.entryProcessorMismatch, false);
  assert.strictEqual(affected.state.indexes.size, 1);
  assert.deepStrictEqual(messagesFor(affected.state, chapterPath), []);
});

void test("returns a new state and leaves the given one unchanged", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const files = {
    [chapterPath]: '<span data-index="index.md?q=a!Apple#index"></span>',
    [indexPath]: '<nav id="index"></nav>',
  };
  const fileSystem: FileSystem = {
    readFileSync: (path) => files[path as keyof typeof files],
    touchSync: () => {},
  };
  const groupReadings = (state: IndexState) =>
    [...state.indexes.values()].flatMap(({ index }) =>
      index.children.map((group) => group.key.reading),
    );

  const initialized = initializeIndexState(
    createIndexState([chapterPath, indexPath]),
    fileSystem,
    () => entryProcessor as never,
  );
  const first = updateIndexState(initialized, chapterPath, fromHtml(files[chapterPath]));
  const edited = updateIndexState(
    first.state,
    chapterPath,
    fromHtml('<span data-index="index.md?q=b!Banana#index"></span>'),
  );
  const settled = updateIndexState(
    edited.state,
    chapterPath,
    fromHtml('<span data-index="index.md?q=b!Banana#index"></span>'),
  );

  assert.notStrictEqual(edited.state, first.state);
  assert.deepStrictEqual(groupReadings(first.state), ["a"]);
  assert.deepStrictEqual(groupReadings(edited.state), ["b"]);
  assert.strictEqual(settled.state, edited.state);
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

  const initialized = initializeIndexState(
    createIndexState([chapterPath, endPath, indexPath]),
    fileSystem,
    () => entryProcessor as never,
  );
  const first = updateIndexState(initialized, endPath, fromHtml(files[endPath]));
  const affected = updateIndexState(first.state, endPath, fromHtml(""));

  assert.deepStrictEqual([...affected.affectedPaths], [chapterPath, indexPath]);
  assert.deepStrictEqual(
    messagesFor(affected.state, chapterPath).map((message) => message[2]?.split(":")[1]),
    ["missing-range-end"],
  );
});

void test("flags only the first update whose snapshot disagrees with the entry processor", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const files = {
    [chapterPath]: '<span data-index="index.md?q=a!Apple#index"></span>',
    [indexPath]: '<nav id="index"></nav>',
  };
  const fileSystem: FileSystem = {
    readFileSync: (path) => files[path as keyof typeof files],
    touchSync: () => {},
  };

  const initialized = initializeIndexState(
    createIndexState([chapterPath, indexPath]),
    fileSystem,
    () => entryProcessor as never,
  );
  const mismatch = updateIndexState(
    initialized,
    chapterPath,
    fromHtml('<span data-index="index.md?q=b!Banana#index"></span>'),
  );
  const edited = updateIndexState(
    mismatch.state,
    chapterPath,
    fromHtml('<span data-index="index.md?q=c!Cherry#index"></span>'),
  );

  assert.strictEqual(mismatch.entryProcessorMismatch, true);
  assert.deepStrictEqual([...mismatch.affectedPaths], []);
  assert.strictEqual(edited.entryProcessorMismatch, false);
  assert.deepStrictEqual([...edited.affectedPaths], [indexPath]);
});

void test("marks documents whose diagnostics change after another source updates", () => {
  const applePath = "/publication/apple.md";
  const bananaPath = "/publication/banana.md";
  const files = {
    [applePath]: '<span data-index="outside.md?q=a!Apple#index"></span>',
    [bananaPath]: '<span data-index="outside.md?q=b!Banana|->a!Apple#index"></span>',
  };
  const fileSystem: FileSystem = {
    readFileSync: (path) => files[path as keyof typeof files],
    touchSync: () => {},
  };

  const initialized = initializeIndexState(
    createIndexState([applePath, bananaPath]),
    fileSystem,
    () => entryProcessor as never,
  );
  const first = updateIndexState(initialized, applePath, fromHtml(files[applePath]));
  const affected = updateIndexState(first.state, applePath, fromHtml(""));

  assert.ok(affected.affectedPaths.has(bananaPath));
  assert.deepStrictEqual(
    messagesFor(affected.state, bananaPath).map((message) => message[2]?.split(":")[1]),
    ["invalid-reference", "vacant-entry", "target-not-in-entries"],
  );
});

void test("applies an entry listed twice once", () => {
  const chapterPath = "/publication/chapter.md";
  const indexPath = "/publication/index.md";
  const files = {
    [chapterPath]: '<span id="a" data-index="index.md?q=a!Apple#index"></span>',
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

  const state = initializeIndexState(
    createIndexState([chapterPath, indexPath, chapterPath]),
    fileSystem,
    () => entryProcessor as never,
  );
  const builtIndex = state.indexes.get(createTargetKey({ path: indexPath, id: "index" }));

  assert.deepStrictEqual(state.entryPaths, [chapterPath, indexPath]);
  assert.deepStrictEqual(reads, [chapterPath, indexPath]);
  assert.strictEqual(builtIndex?.index.children[0]?.children[0]?.locators.length, 1);
});

void test("rejects an entry processor that reaches the index plugin", () => {
  const chapterPath = "/publication/chapter.md";
  const fileSystem: FileSystem = {
    readFileSync: () => "",
    touchSync: () => {},
  };
  const state = createIndexState([chapterPath]);
  const createEntryProcessor = () =>
    ({
      processSync: () => {
        initializeIndexState(state, fileSystem, createEntryProcessor as never);
        return { toString: () => "" };
      },
    }) as never;

  assert.throws(
    () => initializeIndexState(state, fileSystem, createEntryProcessor as never),
    /without the index plugin/,
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

  assert.throws(
    () =>
      initializeIndexState(
        createIndexState([missingPath]),
        fileSystem,
        () => entryProcessor as never,
      ),
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
