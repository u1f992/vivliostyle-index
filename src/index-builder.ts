import {
  applyPageInstruction,
  applyRangeInstruction,
  applyReferenceInstruction,
} from "./instruction.ts";
import { createLocatorHref } from "./locator.ts";
import { addMessage, messages, type MessageArguments } from "./messages.ts";
import { validateReferences, type Index } from "./model.ts";
import type { Attachment, SourceSnapshot } from "./source-snapshot.ts";
import type { Target, TargetKey } from "./target.ts";

export type BuiltIndex = Readonly<{
  target: Target;
  index: Index;
  sourcePath: string;
}>;

export type BuiltIndexes = Readonly<{
  indexes: ReadonlyMap<TargetKey, BuiltIndex>;
  messages: ReadonlyMap<string, readonly MessageArguments[]>;
}>;

function resolveRangeEndHref(
  entryPaths: readonly string[],
  sources: ReadonlyMap<string, SourceSnapshot>,
  attachment: Attachment,
  messagesByDocument: Map<string, MessageArguments[]>,
): string | undefined {
  const rangeEnd = attachment.rangeEnd;
  if (rangeEnd === undefined) {
    return undefined;
  }
  const rangeEndSource = sources.get(rangeEnd.path);
  if (!rangeEndSource?.ids.includes(rangeEnd.id)) {
    addMessage(messagesByDocument, attachment.sourcePath, messages.missingRangeEnd(rangeEnd));
    return undefined;
  }
  const sourceEntryIndex = entryPaths.indexOf(attachment.sourcePath);
  const endEntryIndex = entryPaths.indexOf(rangeEnd.path);
  const endPrecedesSource = endEntryIndex < sourceEntryIndex;
  const endDoesNotFollowSourceElement =
    endEntryIndex === sourceEntryIndex &&
    rangeEndSource.ids.indexOf(rangeEnd.id) <= rangeEndSource.ids.indexOf(attachment.sourceId);
  if (endPrecedesSource || endDoesNotFollowSourceElement) {
    addMessage(messagesByDocument, attachment.sourcePath, messages.rangeEndOrder(rangeEnd));
    return undefined;
  }
  return createLocatorHref(rangeEnd.path, attachment.target.path, rangeEnd.id);
}

export function buildIndexes(
  entryPaths: readonly string[],
  sources: ReadonlyMap<string, SourceSnapshot>,
): BuiltIndexes {
  const entryPathSet = new Set(entryPaths);
  const indexes = new Map<TargetKey, BuiltIndex>();
  const messagesByDocument = new Map<string, MessageArguments[]>();

  for (const [sourcePath, snapshot] of sources) {
    messagesByDocument.set(sourcePath, [...snapshot.messages]);
  }

  for (const entryPath of entryPaths) {
    const snapshot = sources.get(entryPath);
    if (!snapshot) {
      continue;
    }
    for (const attachment of snapshot.attachments) {
      const rangeEndHref =
        attachment.instruction.type === "range"
          ? resolveRangeEndHref(entryPaths, sources, attachment, messagesByDocument)
          : undefined;
      if (attachment.instruction.type === "range" && rangeEndHref === undefined) {
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
      switch (attachment.instruction.type) {
        case "page":
          applyPageInstruction(builtIndex.index, attachment.instruction, attachment.locatorHref);
          break;
        case "range":
          if (rangeEndHref !== undefined) {
            applyRangeInstruction(
              builtIndex.index,
              attachment.instruction,
              attachment.locatorHref,
              rangeEndHref,
            );
          }
          break;
        case "see":
        case "seeAlso":
          applyReferenceInstruction(builtIndex.index, attachment.instruction);
          break;
      }
    }
  }

  for (const { target, index, sourcePath } of indexes.values()) {
    for (const unresolvedReference of validateReferences(index)) {
      addMessage(
        messagesByDocument,
        entryPathSet.has(target.path) ? target.path : sourcePath,
        messages.invalidReference(unresolvedReference),
      );
    }
    if (!entryPathSet.has(target.path)) {
      addMessage(messagesByDocument, sourcePath, messages.targetNotInEntries(target));
    }
  }

  return { indexes, messages: messagesByDocument };
}
