import fs from "node:fs";

export type FileSystem = {
  readFileSync: (path: string) => string;
  touchSync: (path: string) => void;
};

function updateTimestamp(fileName: string) {
  const time = new Date();
  fs.utimesSync(fileName, time, time);
}

function appendAndRestoreSize(fileName: string) {
  const originalSize = fs.statSync(fileName).size;
  const fd = fs.openSync(fileName, "a");
  fs.writeSync(fd, " ");
  fs.ftruncateSync(fd, originalSize);
  fs.closeSync(fd);
}

/**
 * https://qiita.com/Anders/items/b1a9f3dca3f9c3c17241
 */
function touchSync(fileName: string) {
  try {
    updateTimestamp(fileName);
  } catch {
    // `utimesSync` requires the caller to be the file owner when setting
    // explicit timestamps (EPERM on Linux). When the process has write
    // permission but does not own the file (e.g. a bind-mounted workspace
    // in a container with a different UID), we fall back to appending a
    // byte and immediately truncating back to the original size. This
    // changes mtime via actual I/O without altering the file contents.
    appendAndRestoreSize(fileName);
  }
}

export const nodeFileSystem: FileSystem = {
  readFileSync: (path) => fs.readFileSync(path, { encoding: "utf-8" }),
  touchSync,
};
