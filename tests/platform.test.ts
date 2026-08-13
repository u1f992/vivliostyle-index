import assert from "node:assert";
import process from "node:process";
import test from "node:test";

import { documentPath, documentUrl, workingDirectory } from "../src/platform.ts";

void test("round-trips a document path through its file URL", () => {
  const url = documentUrl("/publication/日本語 索引.md");

  assert.strictEqual(url.protocol, "file:");
  assert.strictEqual(documentPath(url), "/publication/日本語 索引.md");
});

void test("names the working directory", () => {
  assert.strictEqual(workingDirectory(), process.cwd());
});
