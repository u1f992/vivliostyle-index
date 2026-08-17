import { execFileSync } from "node:child_process";
import fs from "node:fs";

export type FileSystem = {
  readFileSync: (path: string) => string;
  touchSync: (path: string) => void;
};

type BaseFileSystem = Pick<
  typeof fs,
  | "readFileSync"
  | "utimesSync"
  | "statSync"
  | "openSync"
  | "writeSync"
  | "ftruncateSync"
  | "closeSync"
>;

type ExecuteFileSync = (file: string, args: readonly string[]) => void;

const systemTouchExecutables = ["/usr/bin/touch", "/bin/touch"] as const;

const executeFileSync: ExecuteFileSync = (file, args) => {
  execFileSync(file, args);
};

function updateTimestamp(base: BaseFileSystem, fileName: string) {
  const time = new Date();
  base.utimesSync(fileName, time, time);
}

function appendAndRestoreSize(base: BaseFileSystem, fileName: string) {
  // Opening and closing a writable file does not update mtime. A real write does,
  // so the last-resort path appends one byte and truncates it immediately. The
  // original bytes and size survive, while the filesystem still records the write.
  const originalSize = base.statSync(fileName).size;
  const fd = base.openSync(fileName, "a");
  try {
    base.writeSync(fd, " ");
    base.ftruncateSync(fd, originalSize);
  } finally {
    base.closeSync(fd);
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

// execFileSync copies spawnSync fields onto both spawn errors and child exit errors.
// A spawn error still has status and signal properties, but both values are null;
// a started child has either a numeric exit status or a terminating signal.
function processStarted(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("status" in error && error.status !== null && error.status !== undefined) ||
      ("signal" in error && error.signal !== null && error.signal !== undefined))
  );
}

function executeSystemTouch(
  base: BaseFileSystem,
  execute: ExecuteFileSync,
  fileName: string,
): boolean {
  // POSIX distinguishes explicit timestamps from "set both fields to now".
  // Node's utimesSync supplies explicit values, which normally requires the
  // file owner or CAP_FOWNER on Linux. The system touch command can request
  // the kernel's current-time operation, which also permits a writable file
  // owned by another UID.
  //
  // npm prepends node_modules/.bin to PATH. Absolute system locations prevent
  // a package-provided executable from taking the place of the OS utility.
  for (const executable of systemTouchExecutables) {
    try {
      // The option terminator keeps names such as "--help" from being parsed as
      // command options. execFileSync also avoids shell interpretation entirely.
      execute(executable, ["-c", "--", fileName]);
    } catch (error) {
      // Spawn failures have no child status or signal and can arise from a missing
      // executable, noexec mounts, or Node's process permissions. Once a child has
      // started, its failure describes the target filesystem and must be preserved.
      if (!processStarted(error)) {
        continue;
      }
      throw error;
    }
    // touch -c deliberately reports success when the target is absent. Restore
    // the FileSystem contract by checking that the requested file still exists.
    base.statSync(fileName);
    return true;
  }
  return false;
}

function touchSync(base: BaseFileSystem, execute: ExecuteFileSync | undefined, fileName: string) {
  try {
    // The Node API avoids spawning a process and preserves its precise filesystem
    // errors. EPERM is exceptional because the OS current-time operation has a
    // less restrictive permission model than Node's explicit timestamps.
    updateTimestamp(base, fileName);
    return;
  } catch (error) {
    if (!hasErrorCode(error, "EPERM")) {
      throw error;
    }
  }

  if (execute && executeSystemTouch(base, execute, fileName)) {
    return;
  }
  appendAndRestoreSize(base, fileName);
}

export function createFileSystem(base: BaseFileSystem, execute?: ExecuteFileSync): FileSystem {
  return {
    readFileSync: (path) => base.readFileSync(path, { encoding: "utf-8" }),
    touchSync: (path) => touchSync(base, execute, path),
  };
}

export const nodeFileSystem: FileSystem = createFileSystem(fs, executeFileSync);
