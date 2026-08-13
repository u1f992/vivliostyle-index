import {
  applyPageInstruction,
  applyRangeInstruction,
  applyReferenceInstruction,
} from "./instruction.ts";
import { createLocationHref } from "./location.ts";
import { addMessage, messages, type MessageArguments } from "./messages.ts";
import { findUnresolvedReference, type Index } from "./model.ts";
import { revokeViolations, type Revocable } from "./revocation.ts";
import type { Attachment, SourceSnapshot } from "./source-snapshot.ts";
import type { Target, TargetKey } from "./target.ts";

export type BuiltIndex = Readonly<{
  target: Target;
  index: Index;
  sourcePaths: readonly string[];
}>;

export type BuiltIndexes = Readonly<{
  indexes: ReadonlyMap<TargetKey, BuiltIndex>;
  messages: ReadonlyMap<string, readonly MessageArguments[]>;
}>;

type PendingIndex = Readonly<{
  target: Target;
  index: Index;
  sourcePaths: Set<string>;
  revocables: Revocable[];
}>;

function findRangeEndViolation(
  entryPaths: readonly string[],
  sources: ReadonlyMap<string, SourceSnapshot>,
  attachment: Attachment,
  rangeEnd: Target,
): MessageArguments | undefined {
  const rangeEndSource = sources.get(rangeEnd.path);
  if (!rangeEndSource?.ids.includes(rangeEnd.id)) {
    return messages.missingRangeEnd(rangeEnd);
  }
  const sourceEntryIndex = entryPaths.indexOf(attachment.sourcePath);
  const endEntryIndex = entryPaths.indexOf(rangeEnd.path);
  const endPrecedesSource = endEntryIndex < sourceEntryIndex;
  const endDoesNotFollowSourceElement =
    endEntryIndex === sourceEntryIndex &&
    rangeEndSource.ids.indexOf(rangeEnd.id) <= rangeEndSource.ids.indexOf(attachment.sourceId);
  return endPrecedesSource || endDoesNotFollowSourceElement
    ? messages.rangeEndOrder(rangeEnd)
    : undefined;
}

function ensurePendingIndex(
  pendingIndexes: Map<TargetKey, PendingIndex>,
  attachment: Attachment,
): PendingIndex {
  const pendingIndex = pendingIndexes.get(attachment.targetKey);
  if (pendingIndex) {
    pendingIndex.sourcePaths.add(attachment.sourcePath);
    return pendingIndex;
  }
  const created: PendingIndex = {
    target: attachment.target,
    index: { children: [] },
    sourcePaths: new Set([attachment.sourcePath]),
    revocables: [],
  };
  pendingIndexes.set(attachment.targetKey, created);
  return created;
}

function resolveReportingPath(entryPathSet: ReadonlySet<string>, attachment: Attachment): string {
  return entryPathSet.has(attachment.target.path) ? attachment.target.path : attachment.sourcePath;
}

function resolveReportingPaths(
  entryPathSet: ReadonlySet<string>,
  { target, sourcePaths }: BuiltIndex,
): readonly string[] {
  return entryPathSet.has(target.path) ? [target.path] : sourcePaths;
}

function applyAttachment(
  entryPaths: readonly string[],
  entryPathSet: ReadonlySet<string>,
  sources: ReadonlyMap<string, SourceSnapshot>,
  index: Index,
  attachment: Attachment,
): Revocable | undefined {
  const { instruction } = attachment;

  if (instruction.type === "page") {
    applyPageInstruction(index, instruction, attachment.locationHref);
    return undefined;
  }

  if (instruction.type === "range") {
    const rangeEnd = attachment.rangeEnd;
    if (rangeEnd === undefined) {
      return undefined;
    }
    const revoke = applyRangeInstruction(
      index,
      instruction,
      attachment.locationHref,
      createLocationHref(rangeEnd.path, attachment.target.path, rangeEnd.id),
    );
    return {
      reportingPath: attachment.sourcePath,
      revoke,
      findViolation: () => findRangeEndViolation(entryPaths, sources, attachment, rangeEnd),
    };
  }

  const revoke = applyReferenceInstruction(index, instruction);
  return {
    reportingPath: resolveReportingPath(entryPathSet, attachment),
    revoke,
    findViolation: () => {
      const unresolvedReference = findUnresolvedReference(index, instruction.target);
      return unresolvedReference === undefined
        ? undefined
        : messages.invalidReference(unresolvedReference);
    },
  };
}

export function buildIndexes(
  entryPaths: readonly string[],
  sources: ReadonlyMap<string, SourceSnapshot>,
): BuiltIndexes {
  const entryPathSet = new Set(entryPaths);
  const pendingIndexes = new Map<TargetKey, PendingIndex>();
  const messagesByDocument = new Map<string, MessageArguments[]>();

  for (const [sourcePath, snapshot] of sources) {
    messagesByDocument.set(sourcePath, [...snapshot.messages]);
    if (!entryPathSet.has(sourcePath) && snapshot.attachments.length !== 0) {
      addMessage(messagesByDocument, sourcePath, messages.documentNotInEntries(sourcePath));
    }
  }

  for (const entryPath of entryPaths) {
    const snapshot = sources.get(entryPath);
    if (!snapshot) {
      continue;
    }
    for (const attachment of snapshot.attachments) {
      const pendingIndex = ensurePendingIndex(pendingIndexes, attachment);
      const revocable = applyAttachment(
        entryPaths,
        entryPathSet,
        sources,
        pendingIndex.index,
        attachment,
      );
      if (revocable) {
        pendingIndex.revocables.push(revocable);
      }
    }
  }

  const indexes = new Map<TargetKey, BuiltIndex>();
  for (const [targetKey, { target, index, sourcePaths, revocables }] of pendingIndexes) {
    const builtIndex: BuiltIndex = { target, index, sourcePaths: [...sourcePaths] };
    indexes.set(targetKey, builtIndex);
    revokeViolations(
      {
        index,
        target,
        reportingPaths: resolveReportingPaths(entryPathSet, builtIndex),
        revocables,
      },
      messagesByDocument,
    );
  }

  for (const { target, sourcePaths } of indexes.values()) {
    if (entryPathSet.has(target.path)) {
      continue;
    }
    for (const sourcePath of sourcePaths) {
      addMessage(messagesByDocument, sourcePath, messages.targetNotInEntries(target));
    }
  }

  return { indexes, messages: messagesByDocument };
}
