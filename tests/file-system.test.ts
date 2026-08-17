import assert from "node:assert";
import test from "node:test";

import { Volume } from "memfs";

import { createFileSystem } from "../src/file-system.ts";

const entryPath = "/publication/entry.md";

function errnoError(message: string, code: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function processStartError(message: string, code: string): NodeJS.ErrnoException {
  return Object.assign(errnoError(message, code), { status: null, signal: null });
}

function processExitError(message: string, code: string, status: number): NodeJS.ErrnoException {
  return Object.assign(errnoError(message, code), { status, signal: null });
}

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

void test("does not execute a host command for an injected file system", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const fileSystem = createFileSystem({
    readFileSync: volume.readFileSync.bind(volume),
    utimesSync: () => {
      throw errnoError("EPERM: operation not permitted", "EPERM");
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

void test("uses the system touch command for a writable file the process does not own", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const notOwned = errnoError("EPERM: operation not permitted", "EPERM");
  const executions: [string, readonly string[]][] = [];
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw notOwned;
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: volume.writeSync.bind(volume),
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: volume.closeSync.bind(volume),
    } as never,
    (file, args) => {
      executions.push([file, args]);
      volume.utimesSync(entryPath, new Date(), new Date());
    },
  );

  fileSystem.touchSync(entryPath);

  assert.deepStrictEqual(executions, [["/usr/bin/touch", ["-c", "--", entryPath]]]);
  assert.ok(volume.statSync(entryPath).mtimeMs > 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});

void test("tries the second trusted touch location when the first is unavailable", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const executions: [string, readonly string[]][] = [];
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: volume.writeSync.bind(volume),
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: volume.closeSync.bind(volume),
    } as never,
    (file, args) => {
      executions.push([file, args]);
      if (file === "/usr/bin/touch") {
        throw processStartError("EACCES: permission denied", "EACCES");
      }
      volume.utimesSync(entryPath, new Date(), new Date());
    },
  );

  fileSystem.touchSync(entryPath);

  assert.deepStrictEqual(executions, [
    ["/usr/bin/touch", ["-c", "--", entryPath]],
    ["/bin/touch", ["-c", "--", entryPath]],
  ]);
  assert.ok(volume.statSync(entryPath).mtimeMs > 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});

void test("reports a file removed while the system touch command runs", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  let writes = 0;
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: () => {
        writes++;
        return 1;
      },
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: volume.closeSync.bind(volume),
    } as never,
    () => {
      volume.unlinkSync(entryPath);
    },
  );

  assert.throws(
    () => fileSystem.touchSync(entryPath),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT",
  );
  assert.strictEqual(writes, 0);
});

void test("passes an option-like relative path as an operand", () => {
  const optionLikePath = "--help";
  const executions: [string, readonly string[]][] = [];
  const fileSystem = createFileSystem(
    {
      readFileSync: () => "contents",
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: () => ({ size: 8 }),
      openSync: () => {
        throw new Error("unexpected fallback");
      },
      writeSync: () => 1,
      ftruncateSync: () => undefined,
      closeSync: () => undefined,
    } as never,
    (file, args) => {
      executions.push([file, args]);
    },
  );

  fileSystem.touchSync(optionLikePath);

  assert.deepStrictEqual(executions, [["/usr/bin/touch", ["-c", "--", optionLikePath]]]);
});

void test("propagates a system touch failure without modifying the file", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  const touchFailure = processExitError("EPERM: operation not permitted", "EPERM", 1);
  let writes = 0;
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: () => {
        writes++;
        return 1;
      },
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: volume.closeSync.bind(volume),
    } as never,
    () => {
      throw touchFailure;
    },
  );

  assert.throws(
    () => fileSystem.touchSync(entryPath),
    (error: unknown) => error === touchFailure,
  );
  assert.strictEqual(writes, 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});

void test("falls back when Node denies child process execution", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: volume.writeSync.bind(volume),
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: volume.closeSync.bind(volume),
    } as never,
    () => {
      throw processStartError("Access to this API has been restricted", "ERR_ACCESS_DENIED");
    },
  );

  fileSystem.touchSync(entryPath);

  assert.ok(volume.statSync(entryPath).mtimeMs > 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});

void test("appends and truncates when the system touch command is unavailable", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  volume.utimesSync(entryPath, 0, 0);
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: volume.writeSync.bind(volume),
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: volume.closeSync.bind(volume),
    } as never,
    () => {
      throw processStartError("ENOENT: command not found", "ENOENT");
    },
  );

  fileSystem.touchSync(entryPath);

  assert.ok(volume.statSync(entryPath).mtimeMs > 0);
  assert.strictEqual(fileSystem.readFileSync(entryPath), "contents");
});

void test("closes the descriptor when the fallback write fails", () => {
  const volume = Volume.fromJSON({ [entryPath]: "contents" });
  const diskFull = errnoError("ENOSPC: no space left on device", "ENOSPC");
  const closed: number[] = [];
  const fileSystem = createFileSystem(
    {
      readFileSync: volume.readFileSync.bind(volume),
      utimesSync: () => {
        throw errnoError("EPERM: operation not permitted", "EPERM");
      },
      statSync: volume.statSync.bind(volume),
      openSync: volume.openSync.bind(volume),
      writeSync: () => {
        throw diskFull;
      },
      ftruncateSync: volume.ftruncateSync.bind(volume),
      closeSync: (fd: number) => {
        closed.push(fd);
        volume.closeSync(fd);
      },
    } as never,
    () => {
      throw processStartError("ENOENT: command not found", "ENOENT");
    },
  );

  assert.throws(
    () => fileSystem.touchSync(entryPath),
    (error: unknown) => error === diskFull,
  );
  assert.strictEqual(closed.length, 1);
});
