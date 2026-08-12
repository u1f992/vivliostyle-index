import fs from "node:fs";

import type { FileSystem } from "./file-system.ts";

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

function touchSync(fileName: string) {
  try {
    updateTimestamp(fileName);
  } catch {
    appendAndRestoreSize(fileName);
  }
}

export const nodeFileSystem: FileSystem = {
  readFileSync: (path) => fs.readFileSync(path, { encoding: "utf-8" }),
  touchSync,
};
