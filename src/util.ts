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
    fs.closeSync(fs.openSync(fileName, "w"));
  }
}
