import { fileURLToPath, pathToFileURL } from "node:url";

import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { getXPath } from "hast-util-get-xpath";
import { selectAll } from "hast-util-select";
import type * as unified from "unified";
import upath from "upath";
import type { VFile } from "vfile";

import { parse, read, run, test, type Command, type CommandString } from "./command.ts";
import expand from "./command/expand.ts";
import { default as insertPage } from "./command/insert-page.ts";
import { insertRange, type InsertRangeCommand } from "./command/insert-range.ts";
import { default as insertReference } from "./command/insert-reference.ts";
import type { Index } from "./model.ts";
import { node, type FileSystem } from "./node.ts";
import { validateReferences } from "./resolve.ts";
import { sort, byLocales, byListedOrder, type IndexComparator } from "./sort.ts";

export { byLocales, byListedOrder };
export { node, type FileSystem } from "./node.ts";
export { logMessages } from "./log-messages.ts";

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
  entry: readonly string[];
  entryContext?: string;
  comparators?: Comparators;
  fileSystem?: Readonly<FileSystem>;
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

type Diagnostic = {
  reason: string;
  ruleId: string;
};

type Attachment = {
  sourcePath: string;
  sourceElementId: string;
  target: Target;
  targetKey: TargetKey;
  command: CommandString;
  commandIndex: number;
  locatorHref: string;
  rangeEndTarget?: Target;
};

type SourceSnapshot = {
  attachments: Attachment[];
  diagnostics: Diagnostic[];
  elementIds: string[];
};

type BuiltIndex = {
  target: Target;
  index: Index;
  sourcePath: string;
};

type State = {
  initialized: boolean;
  entryPaths: string[];
  entryPathSet: Set<string>;
  sources: Map<string, SourceSnapshot>;
  indexes: Map<TargetKey, BuiltIndex>;
  diagnostics: Map<string, Diagnostic[]>;
};

const commands = [insertPage, insertRange, insertReference] as unknown as Command[];
const rangeCommandIndex = commands.indexOf(insertRange as unknown as Command);

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
  const diagnostics: Diagnostic[] = [];

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
      diagnostics.push({
        reason: `invalid index reference: ${reference}`,
        ruleId: "invalid-index-reference",
      });
      continue;
    }

    const command = url.searchParams.get("command");
    if (command === null) {
      continue;
    }
    if (!parse(command)) {
      diagnostics.push({
        reason: `cannot parse index command: ${command}`,
        ruleId: "command-parse-error",
      });
      continue;
    }
    const commandIndex = commands.findIndex((candidate) => test(candidate, command));
    if (commandIndex === -1) {
      diagnostics.push({
        reason: `unknown index command: ${command}`,
        ruleId: "unknown-command",
      });
      continue;
    }

    const targetKey = createTargetKey(target);
    const sourceElementId = ensureId(root, elem);
    let rangeEndTarget: Target | undefined;
    if (commandIndex === rangeCommandIndex) {
      const rangeEndReference = read<InsertRangeCommand>(command as CommandString)[2];
      try {
        rangeEndTarget = resolveTarget(rangeEndReference, baseUrl);
        if (rangeEndTarget.elementId === "") {
          throw new TypeError();
        }
      } catch {
        diagnostics.push({
          reason: `invalid range end reference: ${rangeEndReference}`,
          ruleId: "invalid-range-end-reference",
        });
        continue;
      }
    }
    attachments.push({
      sourcePath,
      sourceElementId,
      target,
      targetKey,
      command: command as CommandString,
      commandIndex,
      locatorHref: createLocatorHref(sourcePath, target.documentPath, sourceElementId),
      ...(rangeEndTarget === undefined ? {} : { rangeEndTarget }),
    });
  }

  const elementIds = selectAll("[id]", root).flatMap((element) => {
    const id = getAttribute(element, "id");
    return id === null ? [] : [id];
  });
  return { attachments, diagnostics, elementIds };
}

function addDiagnostic(
  diagnostics: Map<string, Diagnostic[]>,
  documentPath: string,
  diagnostic: Diagnostic,
): void {
  const documentDiagnostics = diagnostics.get(documentPath);
  if (documentDiagnostics) {
    documentDiagnostics.push(diagnostic);
  } else {
    diagnostics.set(documentPath, [diagnostic]);
  }
}

function resolveRangeEndHref(
  state: State,
  attachment: Attachment,
  diagnostics: Map<string, Diagnostic[]>,
): string | undefined {
  const rangeEndTarget = attachment.rangeEndTarget;
  if (rangeEndTarget === undefined) {
    return undefined;
  }
  const rangeEndSource = state.sources.get(rangeEndTarget.documentPath);
  if (!rangeEndSource?.elementIds.includes(rangeEndTarget.elementId)) {
    addDiagnostic(diagnostics, attachment.sourcePath, {
      reason: `range end target ${rangeEndTarget.documentPath}#${rangeEndTarget.elementId} does not exist`,
      ruleId: "missing-range-end",
    });
    return undefined;
  }
  const sourceEntryIndex = state.entryPaths.indexOf(attachment.sourcePath);
  const endEntryIndex = state.entryPaths.indexOf(rangeEndTarget.documentPath);
  const endPrecedesSource = endEntryIndex < sourceEntryIndex;
  const endDoesNotFollowSourceElement =
    endEntryIndex === sourceEntryIndex &&
    rangeEndSource.elementIds.indexOf(rangeEndTarget.elementId) <=
      rangeEndSource.elementIds.indexOf(attachment.sourceElementId);
  if (endPrecedesSource || endDoesNotFollowSourceElement) {
    addDiagnostic(diagnostics, attachment.sourcePath, {
      reason: `range end target ${rangeEndTarget.documentPath}#${rangeEndTarget.elementId} does not follow its start`,
      ruleId: "range-end-order",
    });
    return undefined;
  }
  return createLocatorHref(
    rangeEndTarget.documentPath,
    attachment.target.documentPath,
    rangeEndTarget.elementId,
  );
}

function rebuildIndexes(state: State): void {
  const indexes = new Map<TargetKey, BuiltIndex>();
  const diagnostics = new Map<string, Diagnostic[]>();

  for (const [sourcePath, snapshot] of state.sources) {
    diagnostics.set(sourcePath, [...snapshot.diagnostics]);
  }

  for (const entryPath of state.entryPaths) {
    const snapshot = state.sources.get(entryPath);
    if (!snapshot) {
      continue;
    }
    for (const attachment of snapshot.attachments) {
      const rangeEndHref = resolveRangeEndHref(state, attachment, diagnostics);
      if (attachment.rangeEndTarget !== undefined && rangeEndHref === undefined) {
        continue;
      }
      let builtIndex = indexes.get(attachment.targetKey);
      if (!builtIndex) {
        builtIndex = {
          target: attachment.target,
          index: { children: [] },
          sourcePath: attachment.sourcePath,
        };
        indexes.set(attachment.targetKey, builtIndex);
      }
      run(
        commands[attachment.commandIndex]!,
        attachment.command,
        builtIndex.index,
        attachment.locatorHref,
        rangeEndHref,
      );
    }
  }

  for (const { target, index, sourcePath } of indexes.values()) {
    for (const reason of validateReferences(index)) {
      addDiagnostic(
        diagnostics,
        state.entryPathSet.has(target.documentPath) ? target.documentPath : sourcePath,
        {
          reason,
          ruleId: "invalid-reference",
        },
      );
    }
    if (!state.entryPathSet.has(target.documentPath)) {
      addDiagnostic(diagnostics, sourcePath, {
        reason: `index target ${target.documentPath}#${target.elementId} is not included in entries`,
        ruleId: "target-not-in-entries",
      });
    }
  }

  state.indexes = indexes;
  state.diagnostics = diagnostics;
}

function initializeState(
  state: State,
  fileSystem: Readonly<FileSystem>,
  createEntryProcessor: PluginOptions["createEntryProcessor"],
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
  rebuildIndexes(state);
  state.initialized = true;
}

function sourceSnapshotsEqual(
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): boolean {
  return previous !== undefined && JSON.stringify(previous) === JSON.stringify(current);
}

function affectedDocumentPaths(
  state: State,
  sourcePath: string,
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): Set<string> {
  const targetPaths = new Set(
    [...(previous?.attachments ?? []), ...current.attachments].map(
      (attachment) => attachment.target.documentPath,
    ),
  );
  for (const snapshot of state.sources.values()) {
    for (const attachment of snapshot.attachments) {
      if (attachment.rangeEndTarget?.documentPath === sourcePath) {
        targetPaths.add(attachment.sourcePath);
        targetPaths.add(attachment.target.documentPath);
      }
    }
  }
  return targetPaths;
}

function findTargetElement(root: hast.Root, elementId: string): hast.Element | undefined {
  return selectAll("[id]", root).find((element) => getAttribute(element, "id") === elementId);
}

function renderIndexes(
  root: hast.Root,
  documentPath: string,
  indexes: ReadonlyMap<TargetKey, BuiltIndex>,
  comparators: ReadonlyMap<TargetKey, IndexComparator>,
  file: VFile,
): void {
  for (const [targetKey, { target, index }] of indexes) {
    if (target.documentPath !== documentPath) {
      continue;
    }
    const element = findTargetElement(root, target.elementId);
    if (!element) {
      file.message(
        `index target ${target.documentPath}#${target.elementId} does not exist`,
        undefined,
        "vivliostyle-index:missing-index-target",
      );
      continue;
    }
    const comparator =
      comparators.get(targetKey) ?? defaultComparator(findClosestLang(root, element));
    expand(sort(index, comparator), element, target.elementId);
  }
}

function emitDiagnostics(file: VFile, diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    file.message(diagnostic.reason, undefined, `vivliostyle-index:${diagnostic.ruleId}`);
  }
}

export function createIndexPlugin({
  // Match the field name in Vivliostyle CLI's config.
  entry: entries,
  entryContext,
  comparators = {},
  fileSystem = node,
}: Readonly<CreatePluginOptions>): unified.Plugin<[Readonly<PluginOptions>]> {
  const context = upath.resolve(process.cwd(), entryContext ?? ".");
  const entryPaths = entries.map((entry) => upath.resolve(context, entry));
  const state: State = {
    initialized: false,
    entryPaths,
    entryPathSet: new Set(entryPaths),
    sources: new Map(),
    indexes: new Map(),
    diagnostics: new Map(),
  };
  const normalizedComparators = normalizeComparators(comparators, context);

  return ({ createEntryProcessor }) => {
    return (tree, file) => {
      const rawPath = file.path;
      if (typeof rawPath === "undefined") {
        file.message(
          "cannot extract index entries from anonymous files or render indexes into anonymous files",
          undefined,
          "vivliostyle-index:anonymous-file",
        );
        return;
      }

      const documentPath = upath.resolve(rawPath);
      const root = tree as hast.Root;
      initializeState(state, fileSystem, createEntryProcessor);

      const previousSnapshot = state.sources.get(documentPath);
      const currentSnapshot = collectSourceSnapshot(root, documentPath);
      if (!sourceSnapshotsEqual(previousSnapshot, currentSnapshot)) {
        state.sources.set(documentPath, currentSnapshot);
        rebuildIndexes(state);
        for (const targetPath of affectedDocumentPaths(
          state,
          documentPath,
          previousSnapshot,
          currentSnapshot,
        )) {
          if (targetPath !== documentPath && state.entryPathSet.has(targetPath)) {
            fileSystem.touchSync(targetPath);
          }
        }
      }

      emitDiagnostics(file, state.diagnostics.get(documentPath) ?? []);
      renderIndexes(root, documentPath, state.indexes, normalizedComparators, file);
    };
  };
}
