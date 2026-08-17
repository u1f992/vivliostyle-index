import type * as hast from "hast";
import type * as unified from "unified";
import upath from "upath";

import { renderDocumentIndexes } from "./document-renderer.ts";
import { nodeFileSystem, type FileSystem } from "./file-system.ts";
import {
  createIndexState,
  messagesFor,
  updateIndexState,
  type CreateEntryProcessor,
  type IndexState,
} from "./index-state.ts";
import { emitMessages, messages } from "./messages.ts";
import { workingDirectory } from "./platform.ts";
import type { Settings } from "./settings.ts";
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
  ReadonlyEntry,
  ReadonlyGroup,
  ReadonlyIndex,
  ReadonlySubentry,
  Subentry,
  Xref,
  XrefType,
} from "./model.ts";
export type {
  CreateRenderer,
  EntryListRenderer,
  EntryRenderer,
  FillTemplate,
  GroupListRenderer,
  GroupRenderer,
  HeadingRenderer,
  IndexRenderer,
  LocatorListRenderer,
  LocatorRenderer,
  PreambleRenderer,
  RenderedEntry,
  RenderedGroup,
  RenderedLocator,
  RenderedSubentry,
  RenderedXref,
  SubentryListRenderer,
  SubentryRenderer,
  XrefListRenderer,
  XrefRenderer,
} from "./render.ts";
export type { Settings, TargetSettings } from "./settings.ts";
export { byKeys, byListedOrder, byLocales, defaultComparator } from "./sort.ts";
export type {
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
  settings?: Settings;
  fileSystem?: Readonly<FileSystem>;
};

export type PluginOptions = {
  createEntryProcessor: CreateEntryProcessor;
};

export function createIndexPlugin({
  entry: entries,
  entryContext,
  settings = [],
  fileSystem = nodeFileSystem,
}: Readonly<CreatePluginOptions>): unified.Plugin<[Readonly<PluginOptions>]> {
  const cwd = workingDirectory();
  // Vivliostyle CLI also resolves an omitted entryContext against the working directory:
  // https://github.com/vivliostyle/vivliostyle-cli/blob/v11.1.0/src/config/resolve.ts#L627-L632
  const context = upath.resolve(cwd, entryContext ?? ".");
  const entryPaths = entries.map((entry) => upath.resolve(context, entry));
  let state: IndexState | undefined;
  const settingsByTarget = mapByTarget(settings, context);

  return ({ createEntryProcessor }) =>
    (tree, file) => {
      const rawPath = file.path;
      if (typeof rawPath === "undefined") {
        file.message(...messages.anonymousFile);
        return;
      }

      const documentPath = upath.resolve(cwd, rawPath);
      const root = tree as hast.Root;
      state ??= createIndexState(entryPaths, fileSystem, createEntryProcessor);

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
      renderDocumentIndexes(root, documentPath, state.indexes, settingsByTarget, file);
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
