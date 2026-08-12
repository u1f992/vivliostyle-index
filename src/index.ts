import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import type * as unified from "unified";
import upath from "upath";

import { read, run, test, type Command, type CommandString } from "./command.ts";
import { default as insertPage } from "./command/insert-page.ts";
import { insertRangeStart, insertRangeEnd, deleteRangeStore } from "./command/insert-range.ts";
import { default as insertReference } from "./command/insert-reference.ts";
import { default as expand, type ExpandCommand } from "./command/expand.ts";
import type { Index } from "./model.ts";
import { node, type FileSystem } from "./node.ts";
import { validateReferences } from "./resolve.ts";
import { throwError } from "./util.ts";
import { sort, byLocales, byListedOrder, type Comparators, type IndexComparator } from "./sort.ts";
export { byLocales, byListedOrder };
export { node, type FileSystem } from "./node.ts";

export function defaultComparator(locales?: Intl.LocalesArgument): IndexComparator {
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

function processEntry(root: hast.Root, indexes: Index[], relPath: string | null) {
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
        [insertPage, insertRangeStart, insertRangeEnd, insertReference] as unknown as Command[]
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

function findClosestLang(
  root: hast.Root | hast.Element,
  target: hast.Element,
  inheritedLang?: string,
): string | undefined {
  const lang =
    root.type === "element" ? (getAttribute(root, "lang") ?? inheritedLang) : inheritedLang;
  if (root === target) {
    return lang;
  }
  for (const child of root.children) {
    if (child.type !== "element") {
      continue;
    }
    const found = findClosestLang(child, target, lang);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

type Entry = { path: string; ignoreUpdate: boolean };

export type Config = {
  entryProcessor: unified.Processor;
  entryContext?: string;
  indexEntryMap: Readonly<{ [index: string]: readonly (string | Entry)[] }>;
  comparators?: Comparators;
  fileSystem?: Readonly<FileSystem>;
  log?: (msg: string) => void;
};

export const index: unified.Plugin<[Readonly<Config>]> = ({
  entryProcessor,
  entryContext,
  indexEntryMap,
  comparators = {},
  fileSystem = node,
  log,
}) => {
  log ??= () => {};
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
    const root = tree as hast.Root;

    const rawPath = file.path;
    if (typeof rawPath === "undefined") {
      log(
        "[vivliostyle-index] cannot extract index entries from anonymous files or expand indexes into anonymous files.",
      );
      return;
    }
    const filePath = upath.resolve(rawPath);

    const affects = entryIndexMap.get(filePath);
    if (affects) {
      processEntry(root, [], null);

      // trigger hot reload
      affects
        .filter(({ indexPath, ignoreUpdate }) => indexPath !== filePath && !ignoreUpdate)
        .forEach(({ indexPath }) => {
          log(
            `[vivliostyle-index] ${upath.relative(ctx, filePath)} affects ${upath.relative(ctx, indexPath)}`,
          );
          fileSystem.touchSync(indexPath);
        });
    }

    const dependsOn = normalizedIndexEntryMap.get(filePath);
    if (dependsOn) {
      const indexes: Index[] = [];
      const baseDir = upath.dirname(filePath);

      dependsOn
        .map(({ entryPath }) => ({
          entryPath,
          contents: fileSystem.readFileSync(entryPath),
        }))
        .map(({ entryPath, contents }) => ({
          entryPath,
          root: fromHtml(
            entryProcessor
              .processSync({
                contents,
                path: entryPath,
              })
              .toString(),
          ),
        }))
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
      validateReferences(indexes);

      selectAll("[data-index]", root)
        .map((elem) => ({
          elem,
          data:
            getAttribute(elem, "data-index") ??
            throwError([
              "data === null: won't happen. it's likely a bug in selectAll() or getAttribute()",
            ]),
        }))
        .filter((value): value is typeof value & { data: CommandString } =>
          test(expand, value.data),
        )
        .forEach(({ elem, data }) => {
          const [, indexId] = read<ExpandCommand>(data);
          const target = indexes.find((index) => index.id === indexId);
          if (!target) {
            run(expand, data, [], root, elem, null);
            return;
          }
          const configuredComparator = comparators[indexId];
          const comparator = configuredComparator ?? defaultComparator(findClosestLang(root, elem));
          const sorted = sort([target], { [indexId]: comparator });
          run(expand, data, sorted, root, elem, null);
        });
    }
  };
};
