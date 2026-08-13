import assert from "node:assert";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createTarget, createTargetKey, mapByTarget, resolveTarget } from "../src/target.ts";

void test("separates a document target from its query and fragment", () => {
  const url = new URL(
    "index.md?cache=1&q=a!Apple#%E7%B4%A2%E5%BC%95",
    pathToFileURL("/publication/chapter.md"),
  );

  assert.deepStrictEqual(createTarget(url), {
    path: "/publication/index.md",
    id: "索引",
  });
});

void test("resolves targets relative to the source document", () => {
  const target = resolveTarget("../index.md?q=x#main", pathToFileURL("/publication/chapters/1.md"));

  assert.deepStrictEqual(target, {
    path: "/publication/index.md",
    id: "main",
  });
  assert.strictEqual(createTargetKey(target), '["/publication/index.md","main"]');
});

void test("resolves configured targets and keeps the last configuration", () => {
  const first = () => () => ({ type: "element", tagName: "p", children: [] });
  const second = () => () => ({ type: "element", tagName: "div", children: [] });
  const configurations = mapByTarget(
    [
      [{ path: "indexes/index.md", id: "main" }, first],
      [{ path: "indexes/index.md", id: "main" }, second],
    ],
    "/publication",
  );

  assert.strictEqual(configurations.size, 1);
  assert.strictEqual(
    configurations.get(createTargetKey({ path: "/publication/indexes/index.md", id: "main" })),
    second,
  );
});
