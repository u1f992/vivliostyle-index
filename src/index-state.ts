import deepEqual from "deep-equal";
import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import type * as unified from "unified";
import type { VFileCompatible } from "vfile";

import type { FileSystem } from "./file-system.ts";
import { buildIndexes, type BuiltIndex } from "./index-builder.ts";
import type { MessageArguments } from "./messages.ts";
import { collectSourceSnapshot, type SourceSnapshot } from "./source-snapshot.ts";
import type { TargetKey } from "./target.ts";

export type EntryProcessorInput = {
  path: string;
  contents: string;
};

export type CreateEntryProcessor = (input: Readonly<EntryProcessorInput>) => unified.Processor;

export type IndexState = Readonly<{
  entryPaths: readonly string[];
  entryPathSet: ReadonlySet<string>;
  updatedPaths: ReadonlySet<string>;
  sources: ReadonlyMap<string, SourceSnapshot>;
  indexes: ReadonlyMap<TargetKey, BuiltIndex>;
  messages: ReadonlyMap<string, readonly MessageArguments[]>;
}>;

export type UpdateResult = Readonly<{
  state: IndexState;
  affectedPaths: ReadonlySet<string>;
  entryProcessorMismatch: boolean;
}>;

function readEntry(fileSystem: Readonly<FileSystem>, entryPath: string): string {
  try {
    return fileSystem.readFileSync(entryPath);
  } catch (cause) {
    throw new Error(
      `cannot read entry ${entryPath}. entry paths resolve against entryContext, which defaults to the current working directory.`,
      { cause },
    );
  }
}

function sourceSnapshotsEqual(
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): boolean {
  return previous !== undefined && deepEqual(previous, current, { strict: true });
}

function affectedDocumentPaths(
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): Set<string> {
  const targetPaths = new Set(
    [...(previous?.attachments ?? []), ...current.attachments].map(
      (attachment) => attachment.target.path,
    ),
  );
  return targetPaths;
}

function documentsWithChangedMessages(
  previous: ReadonlyMap<string, readonly MessageArguments[]>,
  current: ReadonlyMap<string, readonly MessageArguments[]>,
): Set<string> {
  const changed = new Set<string>();
  for (const documentPath of new Set([...previous.keys(), ...current.keys()])) {
    if (
      !deepEqual(previous.get(documentPath) ?? [], current.get(documentPath) ?? [], {
        strict: true,
      })
    ) {
      changed.add(documentPath);
    }
  }
  return changed;
}

function rebuild(state: IndexState): IndexState {
  const { indexes, messages } = buildIndexes(state.entryPaths, state.sources);
  return { ...state, indexes, messages };
}

const creatingProcessors = new WeakSet<CreateEntryProcessor>();

export function createIndexState(
  entryPaths: readonly string[],
  fileSystem: Readonly<FileSystem>,
  createEntryProcessor: CreateEntryProcessor,
): IndexState {
  if (creatingProcessors.has(createEntryProcessor)) {
    throw new Error(
      "the entry processor reached the index plugin that invoked it. createEntryProcessor must return a processor without the index plugin.",
    );
  }

  const entryPathSet: ReadonlySet<string> = new Set(entryPaths);
  const uniqueEntryPaths = [...entryPathSet];
  creatingProcessors.add(createEntryProcessor);
  const sources = new Map<string, SourceSnapshot>();
  try {
    for (const entryPath of uniqueEntryPaths) {
      const contents = readEntry(fileSystem, entryPath);
      const input = { path: entryPath, contents } satisfies VFileCompatible;
      const processor = createEntryProcessor(input);
      const html = processor.processSync(input).toString();
      sources.set(entryPath, collectSourceSnapshot(fromHtml(html), entryPath));
    }
  } finally {
    creatingProcessors.delete(createEntryProcessor);
  }

  return rebuild({
    entryPaths: uniqueEntryPaths,
    entryPathSet,
    updatedPaths: new Set(),
    sources,
    indexes: new Map(),
    messages: new Map(),
  });
}

export function updateIndexState(
  state: IndexState,
  documentPath: string,
  root: hast.Root,
): UpdateResult {
  const previous = state.sources.get(documentPath);
  const current = collectSourceSnapshot(root, documentPath);
  const firstUpdate = !state.updatedPaths.has(documentPath);
  const visited = firstUpdate
    ? { ...state, updatedPaths: new Set(state.updatedPaths).add(documentPath) }
    : state;
  if (sourceSnapshotsEqual(previous, current)) {
    return { state: visited, affectedPaths: new Set(), entryProcessorMismatch: false };
  }

  const sources = new Map(state.sources).set(documentPath, current);
  const rebuilt = rebuild({ ...visited, sources });
  // The host runs the plugin identically with and without a file watcher.
  // A first update is indistinguishable from the only pass of a one-shot
  // build, where touching an affected document has no consumer.
  const affectedPaths = firstUpdate
    ? new Set<string>()
    : new Set([
        ...affectedDocumentPaths(previous, current),
        ...documentsWithChangedMessages(state.messages, rebuilt.messages),
      ]);
  return {
    state: rebuilt,
    affectedPaths,
    entryProcessorMismatch: firstUpdate && previous !== undefined,
  };
}

export function messagesFor(state: IndexState, documentPath: string): readonly MessageArguments[] {
  return state.messages.get(documentPath) ?? [];
}
