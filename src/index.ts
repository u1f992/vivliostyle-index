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

type Entry = { path: string; ignoreUpdate: boolean };

export type Config = {
  entryContext?: string;
  indexEntryMap: Readonly<{ [index: string]: readonly (string | Entry)[] }>;
  comparators: Comparators;
};

export const index: unified.Plugin<[Readonly<Config>]> = function (
  this,
  { entryContext, indexEntryMap, comparators },
) {
  const ctx = upath.resolve(process.cwd(), entryContext ?? ".");
  const normalizedIndexEntryMap = new Map(
    Object.entries(indexEntryMap).map(([index, entries]) => [
      upath.resolve(ctx, index),
      entries.map((ent) =>
        typeof ent === "string"
          ? { entryPath: upath.resolve(ctx, ent), ignoreUpdate: false }
          : {
              entryPath: upath.resolve(ctx, ent.path),
              ignoreUpdate: ent.ignoreUpdate,
            },
      ),
    ]),
  );
  const entryIndexMap = normalizedIndexEntryMap.entries().reduce(
    (map, [indexPath, entries]) => {
      entries.forEach(({ entryPath, ignoreUpdate }) => {
        if (!map.has(entryPath)) {
          map.set(entryPath, []);
        }
        map.get(entryPath)!.push({ indexPath, ignoreUpdate });
      });
      return map;
    },
    new Map() as Map<string, { indexPath: string; ignoreUpdate: boolean }[]>,
  );

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

    const affects = entryIndexMap.get(filePath);
    if (affects) {
      processEntry(root, [], null);

      // trigger hot reload
      affects
        .filter(
          ({ indexPath, ignoreUpdate }) =>
            indexPath !== filePath && !ignoreUpdate,
        )
        .forEach(({ indexPath }) => touchSync(indexPath));
    }

    const dependsOn = normalizedIndexEntryMap.get(filePath);
    if (dependsOn) {
      const indexes: Index<Key>[] = [];
      const baseDir = upath.dirname(filePath);

      dependsOn
        .map(({ entryPath }) => ({
          entryPath,
          contents: fs.readFileSync(entryPath, {
            encoding: "utf-8",
          }),
        }))
        .map(({ entryPath, contents }) => {
          let file;
          this.data()["vfmIndex"] = {};
          try {
            file = this.processSync({
              contents,
              path: entryPath,
            });
          } finally {
            delete this.data()["vfmIndex"];
          }
          return { entryPath, root: fromHtml(file.toString()) };
        })
        .forEach(({ entryPath, root }) =>
          processEntry(
            root,
            indexes,
            filePath === entryPath
              ? null
              : upath.relative(baseDir, upath.changeExt(entryPath, ".html")),
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
