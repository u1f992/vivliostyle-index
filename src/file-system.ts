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

function updateTimestamp(base: BaseFileSystem, fileName: string) {
  const time = new Date();
  base.utimesSync(fileName, time, time);
}

function appendAndRestoreSize(base: BaseFileSystem, fileName: string) {
  const originalSize = base.statSync(fileName).size;
  const fd = base.openSync(fileName, "a");
  try {
    base.writeSync(fd, " ");
    base.ftruncateSync(fd, originalSize);
  } finally {
    base.closeSync(fd);
  }
}

/**
 * https://qiita.com/Anders/items/b1a9f3dca3f9c3c17241
 */
function touchSync(base: BaseFileSystem, fileName: string) {
  try {
    updateTimestamp(base, fileName);
  } catch (error) {
    // `utimesSync` requires the caller to be the file owner when setting
    // explicit timestamps (EPERM on Linux). When the process has write
    // permission but does not own the file (e.g. a bind-mounted workspace
    // in a container with a different UID), we fall back to appending a
    // byte and immediately truncating back to the original size. This
    // changes mtime via actual I/O without altering the file contents.
    if ((error as NodeJS.ErrnoException).code !== "EPERM") {
      throw error;
    }
    appendAndRestoreSize(base, fileName);
  }
}

export function createFileSystem(base: BaseFileSystem): FileSystem {
  return {
    readFileSync: (path) => base.readFileSync(path, { encoding: "utf-8" }),
    touchSync: (path) => touchSync(base, path),
  };
}

export const nodeFileSystem: FileSystem = createFileSystem(fs);
