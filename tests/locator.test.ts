import assert from "node:assert";
import test from "node:test";

import { createLocatorHref } from "../src/locator.ts";

void test("creates a fragment-only locator within the target document", () => {
  assert.strictEqual(
    createLocatorHref("/publication/chapter.md", "/publication/chapter.md", "索引 語"),
    "#%E7%B4%A2%E5%BC%95%20%E8%AA%9E",
  );
});

void test("creates an encoded HTML locator relative to the target document", () => {
  assert.strictEqual(
    createLocatorHref("/publication/章 #1.md", "/publication/indexes/index.md", "索引語"),
    "../%E7%AB%A0%20%231.html#%E7%B4%A2%E5%BC%95%E8%AA%9E",
  );
});
