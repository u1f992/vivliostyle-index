import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { nodeFileSystem } from "../src/file-system.ts";

void test("updates the timestamp of an owned file without changing its contents", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vivliostyle-index-"));
  try {
    const filePath = path.join(directory, "entry.md");
    fs.writeFileSync(filePath, "contents");
    fs.utimesSync(filePath, 0, 0);

    nodeFileSystem.touchSync(filePath);

    assert.ok(fs.statSync(filePath).mtimeMs > 0);
    assert.strictEqual(fs.readFileSync(filePath, { encoding: "utf-8" }), "contents");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

void test("propagates the timestamp failure for a missing file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vivliostyle-index-"));
  try {
    const missingPath = path.join(directory, "missing.md");

    assert.throws(
      () => nodeFileSystem.touchSync(missingPath),
      (error: unknown) => {
        const { code, syscall } = error as NodeJS.ErrnoException;
        return code === "ENOENT" && syscall === "utime";
      },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
