import { fileURLToPath, pathToFileURL } from "node:url";

import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { getXPath } from "hast-util-get-xpath";
import { selectAll } from "hast-util-select";
import type * as unified from "unified";
import upath from "upath";

import { run, test, type Command, type CommandString } from "./command.ts";
import expand from "./command/expand.ts";
import { default as insertPage } from "./command/insert-page.ts";
import { insertRangeStart, insertRangeEnd, deleteRangeStore } from "./command/insert-range.ts";
import { default as insertReference } from "./command/insert-reference.ts";
import type { Index } from "./model.ts";
import { node, type FileSystem } from "./node.ts";
import { validateReferences } from "./resolve.ts";
import { sort, byLocales, byListedOrder, type IndexComparator } from "./sort.ts";

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

export type TargetReference = string;
export type Comparators = Readonly<Record<TargetReference, IndexComparator>>;

export type CreatePluginOptions = {
  entries: readonly string[];
  entryContext?: string;
  comparators?: Comparators;
  fileSystem?: Readonly<FileSystem>;
  log?: (message: string) => void;
};

export type EntryProcessorInput = {
  path: string;
  contents: string;
};

export type PluginOptions = {
  createEntryProcessor: (input: Readonly<EntryProcessorInput>) => unified.Processor;
};

type Target = {
  documentPath: string;
  elementId: string;
};

type TargetKey = string;

type Attachment = {
  target: Target;
  targetKey: TargetKey;
  command: CommandString;
  commandIndex: number;
  locatorHref: string;
};

type SourceSnapshot = {
  attachments: Attachment[];
};

type BuiltIndex = {
  target: Target;
  index: Index;
};

type State = {
  initialized: boolean;
  entryPaths: string[];
  entryPathSet: Set<string>;
  sources: Map<string, SourceSnapshot>;
  indexes: Map<TargetKey, BuiltIndex>;
};

const commands = [
  insertPage,
  insertRangeStart,
  insertRangeEnd,
  insertReference,
] as unknown as Command[];

function directoryUrl(path: string): URL {
  const normalized = upath.normalize(path);
  const withTrailingSlash = normalized === "/" ? normalized : `${normalized.replace(/\/+$/v, "")}/`;
  return pathToFileURL(withTrailingSlash);
}

function resolveTarget(reference: string, baseUrl: URL): Target {
  const url = new URL(reference, baseUrl);
  return {
    documentPath: upath.normalize(fileURLToPath(url)),
    elementId: decodeURIComponent(url.hash.slice(1)),
  };
}

function createTargetKey(target: Target): TargetKey {
  return JSON.stringify([target.documentPath, target.elementId]);
}

function normalizeComparators(
  comparators: Comparators,
  entryContext: string,
): Map<TargetKey, IndexComparator> {
  const normalized = new Map<TargetKey, IndexComparator>();
  const originalReferences = new Map<TargetKey, string>();
  const baseUrl = directoryUrl(entryContext);

  for (const [reference, comparator] of Object.entries(comparators)) {
    const targetKey = createTargetKey(resolveTarget(reference, baseUrl));
    const previousReference = originalReferences.get(targetKey);
    if (previousReference !== undefined) {
      throw new TypeError(
        `Comparator references ${JSON.stringify(previousReference)} and ${JSON.stringify(reference)} resolve to the same index target`,
      );
    }
    normalized.set(targetKey, comparator);
    originalReferences.set(targetKey, reference);
  }

  return normalized;
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

function ensureId(tree: Readonly<hast.Root>, elem: hast.Element): string {
  let id = getAttribute(elem, "id");
  if (id !== null) {
    return id;
  }

  id = getXPath(tree, elem);
  if (id === null) {
    throw new Error("id === null: won't happen. it's likely a bug in getXPath()");
  }

  if (elem.properties) {
    elem.properties["id"] = id;
  } else {
    elem.properties = { id };
  }
  return id;
}

function encodeRelativePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function createLocatorHref(sourcePath: string, targetPath: string, id: string): string {
  const relativePath =
    sourcePath === targetPath
      ? ""
      : encodeRelativePath(
          upath.relative(upath.dirname(targetPath), upath.changeExt(sourcePath, ".html")),
        );
  return `${relativePath}#${encodeURIComponent(id)}`;
}

function collectSourceSnapshot(root: hast.Root, sourcePath: string): SourceSnapshot {
  const baseUrl = pathToFileURL(sourcePath);
  const attachments: Attachment[] = [];

  for (const elem of selectAll("[data-index]", root)) {
    const reference = getAttribute(elem, "data-index");
    if (reference === null) {
      continue;
    }

    let url: URL;
    let target: Target;
    try {
      url = new URL(reference, baseUrl);
      target = resolveTarget(reference, baseUrl);
    } catch {
      console.warn(`invalid index reference: ${reference}`);
      continue;
    }

    const command = url.searchParams.get("command");
    if (command === null) {
      continue;
    }
    const commandIndex = commands.findIndex((candidate) => test(candidate, command));
    if (commandIndex === -1) {
      continue;
    }

    const targetKey = createTargetKey(target);
    attachments.push({
      target,
      targetKey,
      command: command as CommandString,
      commandIndex,
      locatorHref: createLocatorHref(sourcePath, target.documentPath, ensureId(root, elem)),
    });
  }

  return { attachments };
}

function rebuildIndexes(state: State, log: (message: string) => void): void {
  const indexes = new Map<TargetKey, BuiltIndex>();

  for (const entryPath of state.entryPaths) {
    const snapshot = state.sources.get(entryPath);
    if (!snapshot) {
      continue;
    }
    for (const attachment of snapshot.attachments) {
      let builtIndex = indexes.get(attachment.targetKey);
      if (!builtIndex) {
        builtIndex = { target: attachment.target, index: { children: [] } };
        indexes.set(attachment.targetKey, builtIndex);
      }
      run(
        commands[attachment.commandIndex]!,
        attachment.command,
        builtIndex.index,
        attachment.locatorHref,
      );
    }
  }

  for (const { target, index } of indexes.values()) {
    deleteRangeStore(index);
    validateReferences(index);
    if (!state.entryPathSet.has(target.documentPath)) {
      log(
        `[vivliostyle-index] index target ${target.documentPath}#${target.elementId} is not included in entries`,
      );
    }
  }

  state.indexes = indexes;
}

function initializeState(
  state: State,
  fileSystem: Readonly<FileSystem>,
  createEntryProcessor: PluginOptions["createEntryProcessor"],
  log: (message: string) => void,
): void {
  if (state.initialized) {
    return;
  }

  const sources = new Map<string, SourceSnapshot>();
  for (const entryPath of state.entryPaths) {
    const contents = fileSystem.readFileSync(entryPath);
    const processor = createEntryProcessor({ path: entryPath, contents });
    const html = processor.processSync({ path: entryPath, contents }).toString();
    sources.set(entryPath, collectSourceSnapshot(fromHtml(html), entryPath));
  }

  state.sources = sources;
  rebuildIndexes(state, log);
  state.initialized = true;
}

function sourceSnapshotsEqual(
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): boolean {
  return previous !== undefined && JSON.stringify(previous) === JSON.stringify(current);
}

function affectedTargetPaths(
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): Set<string> {
  return new Set(
    [...(previous?.attachments ?? []), ...current.attachments].map(
      (attachment) => attachment.target.documentPath,
    ),
  );
}

function findTargetElement(root: hast.Root, elementId: string): hast.Element | undefined {
  return selectAll("[id]", root).find((element) => getAttribute(element, "id") === elementId);
}

function renderIndexes(
  root: hast.Root,
  documentPath: string,
  indexes: ReadonlyMap<TargetKey, BuiltIndex>,
  comparators: ReadonlyMap<TargetKey, IndexComparator>,
  log: (message: string) => void,
): void {
  for (const [targetKey, { target, index }] of indexes) {
    if (target.documentPath !== documentPath) {
      continue;
    }
    const element = findTargetElement(root, target.elementId);
    if (!element) {
      log(
        `[vivliostyle-index] index target ${target.documentPath}#${target.elementId} does not exist`,
      );
      continue;
    }
    const comparator =
      comparators.get(targetKey) ?? defaultComparator(findClosestLang(root, element));
    expand(sort(index, comparator), element, target.elementId);
  }
}

export function createPlugin({
  entries,
  entryContext,
  comparators = {},
  fileSystem = node,
  log = () => {},
}: Readonly<CreatePluginOptions>): unified.Plugin<[Readonly<PluginOptions>]> {
  const context = upath.resolve(process.cwd(), entryContext ?? ".");
  const entryPaths = entries.map((entry) => upath.resolve(context, entry));
  const state: State = {
    initialized: false,
    entryPaths,
    entryPathSet: new Set(entryPaths),
    sources: new Map(),
    indexes: new Map(),
  };
  const normalizedComparators = normalizeComparators(comparators, context);

  return ({ createEntryProcessor }) => {
    return (tree, file) => {
      const rawPath = file.path;
      if (typeof rawPath === "undefined") {
        log(
          "[vivliostyle-index] cannot extract index entries from anonymous files or render indexes into anonymous files.",
        );
        return;
      }

      const documentPath = upath.resolve(rawPath);
      const root = tree as hast.Root;
      initializeState(state, fileSystem, createEntryProcessor, log);

      const previousSnapshot = state.sources.get(documentPath);
      const currentSnapshot = collectSourceSnapshot(root, documentPath);
      if (!sourceSnapshotsEqual(previousSnapshot, currentSnapshot)) {
        state.sources.set(documentPath, currentSnapshot);
        rebuildIndexes(state, log);
        for (const targetPath of affectedTargetPaths(previousSnapshot, currentSnapshot)) {
          if (targetPath !== documentPath && state.entryPathSet.has(targetPath)) {
            fileSystem.touchSync(targetPath);
          }
        }
      }

      renderIndexes(root, documentPath, state.indexes, normalizedComparators, log);
    };
  };
}
