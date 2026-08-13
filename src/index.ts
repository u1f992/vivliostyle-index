import type * as hast from "hast";
import type * as unified from "unified";
import upath from "upath";

import { renderDocumentIndexes } from "./document-renderer.ts";
import { nodeFileSystem, type FileSystem } from "./file-system.ts";
import {
  createIndexState,
  initializeIndexState,
  messagesFor,
  updateIndexState,
  type CreateEntryProcessor,
} from "./index-state.ts";
import { emitMessages, messages } from "./messages.ts";
import { workingDirectory } from "./platform.ts";
import type { Preambles } from "./render.ts";
import type { Comparators } from "./sort.ts";
import { mapByTarget } from "./target.ts";

export { nodeFileSystem } from "./file-system.ts";
export type { FileSystem } from "./file-system.ts";
export { InstructionSyntaxError, parseInstruction } from "./instruction.ts";
export type { ParsedInstruction } from "./instruction.ts";
export type { EntryProcessorInput } from "./index-state.ts";
export type {
  Entry,
  EntryAddress,
  Group,
  Index,
  Key,
  Locator,
  Reference,
  Subentry,
} from "./model.ts";
export type { CreatePreamble, Preambles } from "./render.ts";
export { byKeys, byListedOrder, byLocales, defaultComparator } from "./sort.ts";
export type {
  Comparators,
  CreateIndexComparator,
  CreateKeyComparator,
  EntryComparator,
  IndexComparator,
  KeyComparator,
  ListedKey,
} from "./sort.ts";
export type { Target } from "./target.ts";

export type CreatePluginOptions = {
  entry: readonly string[];
  entryContext?: string;
  comparators?: Comparators;
  preambles?: Preambles;
  fileSystem?: Readonly<FileSystem>;
};

export type PluginOptions = {
  createEntryProcessor: CreateEntryProcessor;
};

export function createIndexPlugin({
  entry: entries,
  entryContext,
  comparators = [],
  preambles = [],
  fileSystem = nodeFileSystem,
}: Readonly<CreatePluginOptions>): unified.Plugin<[Readonly<PluginOptions>]> {
  const cwd = workingDirectory();
  // Vivliostyle CLI also resolves an omitted entryContext against the working directory:
  // https://github.com/vivliostyle/vivliostyle-cli/blob/v11.1.0/src/config/resolve.ts#L627-L632
  const context = upath.resolve(cwd, entryContext ?? ".");
  const entryPaths = entries.map((entry) => upath.resolve(context, entry));
  let state = createIndexState(entryPaths);
  const comparatorsByTarget = mapByTarget(comparators, context);
  const preamblesByTarget = mapByTarget(preambles, context);

  return ({ createEntryProcessor }) =>
    (tree, file) => {
      const rawPath = file.path;
      if (typeof rawPath === "undefined") {
        file.message(...messages.anonymousFile);
        return;
      }

      const documentPath = upath.resolve(cwd, rawPath);
      const root = tree as hast.Root;
      state = initializeIndexState(state, fileSystem, createEntryProcessor);

      const updated = updateIndexState(state, documentPath, root);
      state = updated.state;
      for (const targetPath of updated.affectedPaths) {
        if (targetPath !== documentPath && state.entryPathSet.has(targetPath)) {
          fileSystem.touchSync(targetPath);
        }
      }

      if (updated.entryProcessorMismatch) {
        file.message(...messages.entryProcessorMismatch(documentPath));
      }
      emitMessages(file, messagesFor(state, documentPath));
      renderDocumentIndexes(
        root,
        documentPath,
        state.indexes,
        comparatorsByTarget,
        preamblesByTarget,
        file,
      );
    };
}

export const logMessages: unified.Plugin = () => (_tree, file) => {
  for (const message of file.messages) {
    const origin = [message.source, message.ruleId].filter(Boolean).join(":");
    const output = origin === "" ? String(message) : `${String(message)} ${origin}`;
    if (message.fatal === true) {
      console.error(output);
    } else if (message.fatal === false) {
      console.warn(output);
    } else {
      console.info(output);
    }
  }
};
