import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import process from "node:process";
import test from "node:test";

import { documentPath, documentUrl, workingDirectory } from "../src/platform.ts";

void test("round-trips a document path through its file URL", () => {
  const url = documentUrl("/publication/日本語 索引.md");

  assert.strictEqual(url.protocol, "file:");
  assert.strictEqual(documentPath(url), "/publication/日本語 索引.md");
});

void test("follows a change of the working directory", () => {
  const original = process.cwd();
  const directory = fs.realpathSync(os.tmpdir());
  process.chdir(directory);
  try {
    assert.strictEqual(workingDirectory(), directory);
  } finally {
    process.chdir(original);
  }
});
