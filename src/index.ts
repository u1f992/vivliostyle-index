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
import { resolveProfiles, type Profiles } from "./profile.ts";

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
  IndexError,
  Key,
  Locator,
  LocatorError,
  Subentry,
  Xref,
  XrefError,
  XrefType,
} from "./model.ts";
export type {
  CreateRenderer,
  EntryListRenderer,
  EntryRenderer,
  GroupListRenderer,
  GroupRenderer,
  HeadingRenderer,
  IndexRenderer,
  LocationRenderer,
  LocatorListRenderer,
  LocatorRenderer,
  SubentryListRenderer,
  SubentryRenderer,
  XrefPreferredListRenderer,
  XrefPreferredRenderer,
  XrefPreferredTargetRenderer,
  XrefRelatedListRenderer,
  XrefRelatedRenderer,
  XrefRelatedTargetRenderer,
  XrefRenderer,
  XrefTargetRenderer,
} from "./render.ts";
export { defaultRenderer } from "./render.ts";
export { defaultProfile } from "./profile.ts";
export type { IndexProfile, Profiles, ResolvedIndexProfile } from "./profile.ts";
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

export type CreateIndexPluginOptions = {
  entry: readonly string[];
  entryContext?: string;
  profiles?: Profiles;
  fileSystem?: Readonly<FileSystem>;
};

export type IndexPluginOptions = {
  /**
   * Creates the processor used to read every configured entry before the host processes it.
   *
   * This option exists because of a design limitation: when the host processes an index target,
   * documents that the host will process after that target have not yet produced their transformed
   * trees. The plugin needs their index data to render the target, so it processes every configured
   * entry in advance.
   *
   * The returned processor must reproduce the transformation that the host will later apply, but
   * without this plugin, and must read document metadata in the same way. Including this plugin
   * would invoke it recursively.
   *
   * The plugin obtains this factory while the host is processing one document, then uses it for
   * every entry. A host may supply different processor options for each entry. The factory must
   * account for those options or rely only on differences that do not change the collected index
   * data. For example, Vivliostyle CLI supplies each manuscript with `style`, `title`, and
   * `language` options.
   *
   * @see https://github.com/vivliostyle/vivliostyle-cli/blob/v11.1.0/src/processor/compile.ts#L195-L212
   */
  createEntryProcessor: CreateEntryProcessor;
};

export function createIndexPlugin({
  entry: entries,
  entryContext,
  profiles = {},
  fileSystem = nodeFileSystem,
}: Readonly<CreateIndexPluginOptions>): unified.Plugin<[Readonly<IndexPluginOptions>]> {
  const cwd = workingDirectory();
  // Vivliostyle CLI also resolves an omitted entryContext against the working directory:
  // https://github.com/vivliostyle/vivliostyle-cli/blob/v11.1.0/src/config/resolve.ts#L627-L632
  const context = upath.resolve(cwd, entryContext ?? ".");
  const entryPaths = entries.map((entry) => upath.resolve(context, entry));
  let state: IndexState | undefined;
  const profilesByName = resolveProfiles(profiles);

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
      renderDocumentIndexes(root, documentPath, state.indexes, profilesByName, file);
    };
}

export const logMessages: unified.Plugin = () => (_tree, file) => {
  for (const message of file.messages) {
    const location = [message.file, message.line ?? 1, message.column ?? 1]
      .filter((part) => part !== undefined && part !== "")
      .join(":");
    const origin = [message.source, message.ruleId].filter(Boolean).join(":");
    const report = `${location}: ${message.reason}`;
    const output = origin === "" ? report : `${report} (${origin})`;
    if (message.fatal === true) {
      console.error(output);
    } else if (message.fatal === false) {
      console.warn(output);
    } else {
      console.info(output);
    }
  }
};
