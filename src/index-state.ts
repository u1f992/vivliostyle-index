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

function sourceSnapshotsEqual(
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): boolean {
  return previous !== undefined && JSON.stringify(previous) === JSON.stringify(current);
}

function affectedDocumentPaths(
  sources: ReadonlyMap<string, SourceSnapshot>,
  sourcePath: string,
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot,
): Set<string> {
  const targetPaths = new Set(
    [...(previous?.attachments ?? []), ...current.attachments].map(
      (attachment) => attachment.target.documentPath,
    ),
  );
  for (const snapshot of sources.values()) {
    for (const attachment of snapshot.attachments) {
      if (attachment.rangeEndTarget?.documentPath === sourcePath) {
        targetPaths.add(attachment.sourcePath);
        targetPaths.add(attachment.target.documentPath);
      }
    }
  }
  return targetPaths;
}

export class IndexState {
  readonly entryPaths: readonly string[];
  readonly entryPathSet: ReadonlySet<string>;
  #initialized = false;
  #sources = new Map<string, SourceSnapshot>();
  #indexes = new Map<TargetKey, BuiltIndex>();
  #messages = new Map<string, readonly MessageArguments[]>();

  constructor(entryPaths: readonly string[]) {
    this.entryPaths = entryPaths;
    this.entryPathSet = new Set(entryPaths);
  }

  get indexes(): ReadonlyMap<TargetKey, BuiltIndex> {
    return this.#indexes;
  }

  messagesFor(documentPath: string): readonly MessageArguments[] {
    return this.#messages.get(documentPath) ?? [];
  }

  initialize(fileSystem: Readonly<FileSystem>, createEntryProcessor: CreateEntryProcessor): void {
    if (this.#initialized) {
      return;
    }

    for (const entryPath of this.entryPaths) {
      const contents = fileSystem.readFileSync(entryPath);
      const input = { path: entryPath, contents } satisfies VFileCompatible;
      const processor = createEntryProcessor(input);
      const html = processor.processSync(input).toString();
      this.#sources.set(entryPath, collectSourceSnapshot(fromHtml(html), entryPath));
    }

    this.#rebuild();
    this.#initialized = true;
  }

  update(documentPath: string, root: hast.Root): ReadonlySet<string> {
    const previous = this.#sources.get(documentPath);
    const current = collectSourceSnapshot(root, documentPath);
    if (sourceSnapshotsEqual(previous, current)) {
      return new Set();
    }

    this.#sources.set(documentPath, current);
    const affectedPaths = affectedDocumentPaths(this.#sources, documentPath, previous, current);
    this.#rebuild();
    return affectedPaths;
  }

  #rebuild(): void {
    const { indexes, messages } = buildIndexes(this.entryPaths, this.#sources);
    this.#indexes = new Map(indexes);
    this.#messages = new Map(messages);
  }
}
