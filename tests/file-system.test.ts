import assert from "node:assert";
import test from "node:test";

import { Volume } from "memfs";

import { createFileSystem } from "../src/file-system.ts";

const entryPath = "/publication/entry.md";

void test("updates the timestamp of an owned file without changing its contents", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const fileSystem = createFileSystem(volume as never);

  fileSystem.touchSync(entryPath);

  assert.ok(volume.statSync(entryPath).mtimeMs > 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});

void test("propagates the timestamp failure for a missing file", () => {
  const volume = Volume.fromJSON({});
  const fileSystem = createFileSystem(volume as never);

  assert.throws(
    () => fileSystem.touchSync("/publication/missing.md"),
    (error: unknown) =>
      (error as NodeJS.ErrnoException).code === "ENOENT" && /utimes/.test((error as Error).message),
  );
});

void test("appends and truncates a file the process does not own", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const notOwned = new Error("EPERM: operation not permitted") as NodeJS.ErrnoException;
  notOwned.code = "EPERM";
  const fileSystem = createFileSystem({
    readFileSync: volume.readFileSync.bind(volume),
    utimesSync: () => {
      throw notOwned;
    },
    statSync: volume.statSync.bind(volume),
    openSync: volume.openSync.bind(volume),
    writeSync: volume.writeSync.bind(volume),
    ftruncateSync: volume.ftruncateSync.bind(volume),
    closeSync: volume.closeSync.bind(volume),
  } as never);

  fileSystem.touchSync(entryPath);

  assert.ok(volume.statSync(entryPath).mtimeMs > 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});
