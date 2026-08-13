import assert from "node:assert";
import test from "node:test";

import { defaultComparator, normalizeComparators } from "../src/sort.ts";
import { createTargetKey } from "../src/target.ts";

void test("creates comparators for every index collection", () => {
  const comparator = defaultComparator("ja");

  assert.deepStrictEqual(Object.keys(comparator), [
    "group",
    "mainEntry",
    "mainEntryLocator",
    "mainEntrySee",
    "mainEntrySeeAlso",
    "subentry",
    "subentryLocator",
    "subentrySee",
    "subentrySeeAlso",
  ]);
  assert.ok(Object.values(comparator).every((compare) => typeof compare === "function"));
});

void test("normalizes comparator targets and keeps the last configuration", () => {
  const first = defaultComparator("en");
  const second = defaultComparator("ja");
  const comparators = normalizeComparators(
    [
      [{ path: "indexes/index.md", id: "main" }, first],
      [{ path: "indexes/index.md", id: "main" }, second],
    ],
    "/publication",
  );
  const key = createTargetKey({
    documentPath: "/publication/indexes/index.md",
    elementId: "main",
  });

  assert.strictEqual(comparators.size, 1);
  assert.strictEqual(comparators.get(key), second);
});
