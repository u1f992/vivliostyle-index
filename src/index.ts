import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import fs from "node:fs";
import type * as unified from "unified";
import upath from "upath";

import { run, test, type Command } from "./command.js";
import { default as insertPage } from "./command/insert-page.js";
import {
  insertRangeStart,
  insertRangeEnd,
  deleteRangeStore,
} from "./command/insert-range.js";
import { default as insertReference } from "./command/insert-reference.js";
import { default as expand } from "./command/expand.js";
import type { Index, Key } from "./model.js";
import { resolve } from "./resolve.js";
import { throwError, touchSync } from "./util.js";
import { sort, byLocales, byListedOrder, type Comparators } from "./sort.js";
export { byLocales, byListedOrder };

export function defaultComparator(
  locales?: Intl.LocalesArgument,
): Comparators[string] {
  return {
    group: byLocales(locales),
    mainEntry: byLocales(locales),
    mainEntryLocator: byListedOrder,
    mainEntrySee: byLocales(locales),
    mainEntrySeeAlso: byLocales(locales),
    subentry: byLocales(locales),
    subentryLocator: byListedOrder,
    subentrySee: byLocales(locales),
    subentrySeeAlso: byLocales(locales),
  };
}

function processEntry(
  root: hast.Root,
  indexes: Index<Key>[],
  relPath: string | null,
) {
  selectAll("[data-index]", root)
    .map((elem) => ({
      elem,
      data:
        getAttribute(elem, "data-index") ??
        throwError([
          "data === null: won't happen. it's likely a bug in selectAll() or getAttribute()",
        ]),
    }))
    .map(({ elem, data }) => ({
      elem,
      data,
      cmd: (
        [
          insertPage,
          insertRangeStart,
          insertRangeEnd,
          insertReference,
        ] as unknown as Command[]
      ).find((cmd) => test(cmd, data)),
    }))
    .filter((obj): obj is typeof obj & { cmd: Command } => !!obj.cmd)
    .forEach(({ elem, data, cmd }) =>
      run(
        cmd,
        // @ts-expect-error branded
        data,
        indexes,
        root,
        elem,
        relPath,
      ),
    );
}

export type Config = {
  entryContext?: string;
  indexEntryMap: Readonly<{ [index: string]: readonly string[] }>;
  comparators: Comparators;
};

export const index: unified.Plugin<[Readonly<Config>]> = function (
  this,
  { entryContext, indexEntryMap, comparators },
) {
  const ctx = upath.resolve(process.cwd(), entryContext ?? ".");
  indexEntryMap = Object.fromEntries(
    Object.entries(indexEntryMap).map(([index, entries]) => [
      upath.resolve(ctx, index),
      entries.map((entry) => upath.resolve(ctx, entry)),
    ]),
  );
  const entryIndexMap = Object.entries(indexEntryMap).reduce(
    (acc, [index, entries]) => {
      entries.forEach((entry) => (acc[entry] ??= []).push(index));
      return acc;
    },
    {} as { [entry: string]: string[] },
  );
  const indexPaths = new Set(Object.keys(indexEntryMap));
  const entryPaths = new Set(Object.keys(entryIndexMap));

  return (tree, file) => {
    if (this.data()["vfmIndex"]) {
      return;
    }
    const root = tree as hast.Root;

    const rawPath = file.path;
    if (typeof rawPath === "undefined") {
      console.warn(
        "cannot extract index entries from anonymous files or expand indexes into anonymous files.",
      );
      return;
    }
    const filePath = upath.resolve(rawPath);

    if (entryPaths.has(filePath)) {
      processEntry(root, [], null);

      // trigger hot reload
      entryIndexMap[filePath]!.filter((path) => path !== filePath).forEach(
        touchSync,
      );
    }

    if (indexPaths.has(filePath)) {
      const indexes: Index<Key>[] = [];
      const baseDir = upath.dirname(filePath);

      indexEntryMap[filePath]!.map((path) => ({
        path,
        content: fs.readFileSync(path, {
          encoding: "utf-8",
        }),
      }))
        .map(({ path, content }) => {
          let file;
          this.data()["vfmIndex"] = {};
          try {
            file = this.processSync({
              contents: content,
              path: path,
            });
          } finally {
            delete this.data()["vfmIndex"];
          }
          return { path, root: fromHtml(file.toString()) };
        })
        .forEach(({ path, root }) =>
          processEntry(
            root,
            indexes,
            filePath === path
              ? null
              : upath.relative(baseDir, upath.changeExt(path, ".html")),
          ),
        );

      deleteRangeStore(indexes);
      const resolved = sort(resolve(indexes), comparators);

      selectAll("[data-index]", root)
        .map((elem) => ({
          elem,
          data:
            getAttribute(elem, "data-index") ??
            throwError([
              "data === null: won't happen. it's likely a bug in selectAll() or getAttribute()",
            ]),
        }))
        .filter(({ data }) => test(expand, data))
        .forEach(({ elem, data }) =>
          run(
            expand,
            // @ts-expect-error branded
            data,
            resolved,
            root,
            elem,
            null,
          ),
        );
    }
  };
};
