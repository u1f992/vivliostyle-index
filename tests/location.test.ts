import assert from "node:assert";
import test from "node:test";

import { createLocationHref } from "../src/location.ts";

void test("creates a fragment-only location within the target document", () => {
  assert.strictEqual(
    createLocationHref("/publication/chapter.md", "/publication/chapter.md", "索引 語"),
    "#%E7%B4%A2%E5%BC%95%20%E8%AA%9E",
  );
});

void test("creates an encoded HTML location relative to the target document", () => {
  assert.strictEqual(
    createLocationHref("/publication/章 #1.md", "/publication/indexes/index.md", "索引語"),
    "../%E7%AB%A0%20%231.html#%E7%B4%A2%E5%BC%95%E8%AA%9E",
  );
});

void test("keeps an extension the build leaves alone", () => {
  for (const [source, expected] of [
    ["/publication/chapter.html", "chapter.html"],
    ["/publication/chapter.htm", "chapter.htm"],
    ["/publication/chapter.xhtml", "chapter.xhtml"],
    ["/publication/chapter.XHTML", "chapter.XHTML"],
  ] as const) {
    assert.strictEqual(createLocationHref(source, "/publication/index.md", "a"), `${expected}#a`);
  }
});

void test("rewrites every other extension to html", () => {
  for (const source of [
    "/publication/chapter.md",
    "/publication/chapter.adoc",
    "/publication/chapter.txt",
  ]) {
    assert.strictEqual(createLocationHref(source, "/publication/index.md", "a"), "chapter.html#a");
  }
});
