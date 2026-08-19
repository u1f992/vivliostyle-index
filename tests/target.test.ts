import assert from "node:assert";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createTarget, createTargetKey, resolveTarget } from "../src/target.ts";

void test("separates a document target from its query and fragment", () => {
  const url = new URL(
    "index.md?cache=1&q=a!Apple#%E7%B4%A2%E5%BC%95",
    pathToFileURL("/publication/chapter.md"),
  );

  assert.deepStrictEqual(createTarget(url), {
    path: "/publication/index.md",
    fragment: "索引",
  });
});

void test("resolves targets relative to the source document", () => {
  const target = resolveTarget("../index.md?q=x#main", pathToFileURL("/publication/chapters/1.md"));

  assert.deepStrictEqual(target, {
    path: "/publication/index.md",
    fragment: "main",
  });
  assert.strictEqual(createTargetKey(target), '["/publication/index.md","main"]');
});
