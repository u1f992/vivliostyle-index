import fs from "node:fs";

type CtorWith<TArgs extends unknown[]> = new (...args: TArgs) => Error;
export function throwError<TArgs extends unknown[]>(
  args: TArgs,
  { ctor }: { ctor?: CtorWith<TArgs> } = {},
): never {
  throw new ((ctor ?? Error) as CtorWith<TArgs>)(...args);
}

/**
 * https://qiita.com/Anders/items/b1a9f3dca3f9c3c17241
 */
export function touchSync(fileName: string) {
  try {
    const time = new Date();
    fs.utimesSync(fileName, time, time);
  } catch {
    // `utimesSync` requires the caller to be the file owner when setting
    // explicit timestamps (EPERM on Linux). When the process has write
    // permission but does not own the file (e.g. a bind-mounted workspace
    // in a container with a different UID), we fall back to appending a
    // byte and immediately truncating back to the original size. This
    // changes mtime via actual I/O without altering the file contents.
    const originalSize = fs.statSync(fileName).size;
    const fd = fs.openSync(fileName, "a");
    fs.writeSync(fd, " ");
    fs.ftruncateSync(fd, originalSize);
    fs.closeSync(fd);
  }
}
