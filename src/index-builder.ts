import {
  applyPageInstruction,
  applyRangeInstruction,
  applyXrefInstruction,
} from "./instruction.ts";
import { addMessage, messages, type MessageArguments } from "./messages.ts";
import {
  createIndexBuilder,
  finalizeIndex,
  labelInvalidXrefs,
  type EntryAddress,
  type Index,
  type IndexBuilder,
} from "./model.ts";
import type { Attachment, SourceSnapshot } from "./source-snapshot.ts";
import type { Target, TargetKey } from "./target.ts";
import { identityTemplate } from "./template.ts";

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
  builder: IndexBuilder;
  sourcePaths: Set<string>;
  attachments: Attachment[];
  xrefValidations: XrefValidation[];
}>;

type XrefValidation = Readonly<{
  reportingPath: string;
  target: EntryAddress;
}>;

type RangeStartAttachment = Attachment &
  Readonly<{ instruction: Extract<Attachment["instruction"], { type: "range-start" }> }>;
type RangeEndAttachment = Attachment &
  Readonly<{ instruction: Extract<Attachment["instruction"], { type: "range-end" }> }>;
type RangePairings = Readonly<{
  endsByStart: ReadonlyMap<RangeStartAttachment, RangeEndAttachment>;
  pairedEnds: ReadonlySet<RangeEndAttachment>;
}>;

const addressKey = (attachment: Attachment): string =>
  JSON.stringify(attachment.instruction.address);

function ensurePendingIndex(
  pendingIndexes: Map<TargetKey, PendingIndex>,
  attachment: Attachment,
): PendingIndex {
  const pendingIndex = pendingIndexes.get(attachment.targetKey);
  if (pendingIndex) {
    pendingIndex.sourcePaths.add(attachment.sourcePath);
    pendingIndex.attachments.push(attachment);
    return pendingIndex;
  }
  const created: PendingIndex = {
    target: attachment.target,
    builder: createIndexBuilder(),
    sourcePaths: new Set([attachment.sourcePath]),
    attachments: [attachment],
    xrefValidations: [],
  };
  pendingIndexes.set(attachment.targetKey, created);
  return created;
}

function applyAttachment(
  builder: IndexBuilder,
  attachment: Attachment,
  rangePairings: RangePairings,
): XrefValidation | undefined {
  const { instruction } = attachment;

  if (instruction.type === "page") {
    applyPageInstruction(builder, instruction, attachment.locationHref);
    return undefined;
  }

  if (instruction.type === "range-start") {
    const rangeEnd = rangePairings.endsByStart.get(attachment as RangeStartAttachment);
    if (rangeEnd !== undefined) {
      applyRangeInstruction(builder, instruction, attachment.locationHref, rangeEnd.locationHref);
    } else {
      applyPageInstruction(
        builder,
        { type: "page", address: instruction.address, template: instruction.template },
        attachment.locationHref,
        "unmatched-range-start",
      );
    }
    return undefined;
  }

  if (instruction.type === "range-end") {
    if (!rangePairings.pairedEnds.has(attachment as RangeEndAttachment)) {
      applyPageInstruction(
        builder,
        { type: "page", address: instruction.address, template: identityTemplate },
        attachment.locationHref,
        "unmatched-range-end",
      );
    }
    return undefined;
  }

  applyXrefInstruction(builder, instruction);
  return {
    reportingPath: attachment.sourcePath,
    target: instruction.target,
  };
}

function validateXrefs(
  builder: IndexBuilder,
  validations: readonly XrefValidation[],
  messagesByDocument: Map<string, MessageArguments[]>,
): void {
  const unresolvedXrefs = labelInvalidXrefs(builder);
  for (const { reportingPath, target } of validations) {
    const unresolvedXref = unresolvedXrefs.get(JSON.stringify(target));
    if (unresolvedXref !== undefined) {
      addMessage(messagesByDocument, reportingPath, messages.invalidXref(unresolvedXref));
    }
  }
}

function pairRanges(
  pendingIndex: PendingIndex,
  messagesByDocument: Map<string, MessageArguments[]>,
): RangePairings {
  const startsByAddress = new Map<string, RangeStartAttachment[]>();
  const endsByStart = new Map<RangeStartAttachment, RangeEndAttachment>();
  const pairedEnds = new Set<RangeEndAttachment>();
  for (const attachment of pendingIndex.attachments) {
    if (attachment.instruction.type === "range-start") {
      const starts = startsByAddress.get(addressKey(attachment)) ?? [];
      starts.push(attachment as RangeStartAttachment);
      startsByAddress.set(addressKey(attachment), starts);
      continue;
    }
    if (attachment.instruction.type !== "range-end") {
      continue;
    }
    const starts = startsByAddress.get(addressKey(attachment));
    const start = starts?.pop();
    if (start === undefined) {
      addMessage(
        messagesByDocument,
        attachment.sourcePath,
        messages.unmatchedRangeEnd(pendingIndex.target, attachment.instruction.address),
      );
      continue;
    }
    const rangeEnd = attachment as RangeEndAttachment;
    endsByStart.set(start, rangeEnd);
    pairedEnds.add(rangeEnd);
  }
  for (const starts of startsByAddress.values()) {
    for (const start of starts) {
      addMessage(
        messagesByDocument,
        start.sourcePath,
        messages.unmatchedRangeStart(pendingIndex.target, start.instruction.address),
      );
    }
  }
  return { endsByStart, pairedEnds };
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
      ensurePendingIndex(pendingIndexes, attachment);
    }
  }

  const indexes = new Map<TargetKey, BuiltIndex>();
  for (const [targetKey, pendingIndex] of pendingIndexes) {
    const { target, builder, sourcePaths, attachments, xrefValidations } = pendingIndex;
    const rangePairings = pairRanges(pendingIndex, messagesByDocument);
    for (const attachment of attachments) {
      const validation = applyAttachment(builder, attachment, rangePairings);
      if (validation) {
        xrefValidations.push(validation);
      }
    }
    validateXrefs(builder, xrefValidations, messagesByDocument);
    const builtIndex: BuiltIndex = {
      target,
      index: finalizeIndex(builder),
      sourcePaths: [...sourcePaths],
    };
    indexes.set(targetKey, builtIndex);
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
