import type { VFile } from "vfile";

import { InstructionSyntaxError } from "./instruction.ts";
import type { EntryAddress, UnresolvedXref } from "./model.ts";
import type { Target } from "./target.ts";

export type MessageArguments = Parameters<VFile["message"]>;

const rule = (ruleId: string): string => `vivliostyle-index:${ruleId}`;
const formatTarget = (target: Target): string => `${target.path}#${target.id}`;
const formatEntryAddress = ({ group, entry, subentry }: EntryAddress): string => {
  const parts = [`group=${JSON.stringify(group)}`, `entry=${JSON.stringify(entry)}`];
  if (subentry !== undefined) {
    parts.push(`subentry=${JSON.stringify(subentry)}`);
  }
  return parts.join(",");
};
const formatUnresolvedXref = ({ target, missing }: UnresolvedXref): string => {
  const parts = [`group=${JSON.stringify(target.group)}`];
  if (missing !== "group") {
    parts.push(`entry=${JSON.stringify(target.entry)}`);
  }
  if (missing === "subentry") {
    parts.push(`subentry=${JSON.stringify(target.subentry)}`);
  }
  return parts.join(",");
};

export const messages = {
  anonymousFile: [
    "cannot extract index entries from anonymous files or render indexes into anonymous files",
    undefined,
    rule("anonymous-file"),
  ] as MessageArguments,
  invalidIndexReference: (reference: string): MessageArguments => [
    `invalid index reference: ${reference}`,
    undefined,
    rule("invalid-index-reference"),
  ],
  missingTargetFragment: (reference: string): MessageArguments => [
    `index reference has no target fragment: ${reference}`,
    undefined,
    rule("missing-target-fragment"),
  ],
  missingInstruction: (reference: string): MessageArguments => [
    `index reference has no q instruction: ${reference}`,
    undefined,
    rule("missing-instruction"),
  ],
  invalidInstruction: (error: unknown, instructionSource: string): MessageArguments => [
    error instanceof InstructionSyntaxError
      ? error.message
      : `cannot parse index instruction: ${instructionSource}`,
    undefined,
    rule("instruction-parse-error"),
  ],
  duplicateId: (id: string): MessageArguments => [
    `id ${JSON.stringify(id)} appears more than once. locators, ranges, and indexes addressing it may resolve to the wrong element.`,
    undefined,
    rule("duplicate-id"),
  ],
  invalidRangeEndReference: (reference: string): MessageArguments => [
    `invalid range end reference: ${reference}`,
    undefined,
    rule("invalid-range-end-reference"),
  ],
  missingRangeEnd: (target: Target): MessageArguments => [
    `range end target ${formatTarget(target)} does not exist. the range is revoked.`,
    undefined,
    rule("missing-range-end"),
  ],
  rangeEndNotInEntries: (target: Target): MessageArguments => [
    `range end target ${formatTarget(target)} is in a document not included in entries. the range is revoked.`,
    undefined,
    rule("range-end-not-in-entries"),
  ],
  rangeEndOrder: (target: Target): MessageArguments => [
    `range end target ${formatTarget(target)} does not follow its start. the range is revoked.`,
    undefined,
    rule("range-end-order"),
  ],
  invalidXref: (xref: UnresolvedXref): MessageArguments => [
    `index does not contain ${formatUnresolvedXref(xref)}. the cross-reference is revoked.`,
    undefined,
    rule("invalid-xref"),
  ],
  vacantEntry: (target: Target, address: EntryAddress): MessageArguments => [
    `entry ${formatEntryAddress(address)} of index target ${formatTarget(target)} holds no locator, cross-reference, or subentry. the entry is revoked.`,
    undefined,
    rule("vacant-entry"),
  ],
  targetNotInEntries: (target: Target): MessageArguments => [
    `index target ${formatTarget(target)} is not included in entries`,
    undefined,
    rule("target-not-in-entries"),
  ],
  entryProcessorMismatch: (documentPath: string): MessageArguments => [
    `the entry processor and the build produced different index data for ${documentPath}. locators into it may not resolve.`,
    undefined,
    rule("entry-processor-mismatch"),
  ],
  documentNotInEntries: (documentPath: string): MessageArguments => [
    `document ${documentPath} is not included in entries. its index instructions are ignored.`,
    undefined,
    rule("document-not-in-entries"),
  ],
  unsupportedLanguage: (language: string): MessageArguments => [
    `cannot sort by language ${JSON.stringify(language)}. the index is sorted without it.`,
    undefined,
    rule("unsupported-language"),
  ],
  missingIndexTarget: (target: Target): MessageArguments => [
    `index target ${formatTarget(target)} does not exist`,
    undefined,
    rule("missing-index-target"),
  ],
  missingIndexRole: (target: Target): MessageArguments => [
    `index target ${formatTarget(target)} does not carry the doc-index role. the index is not rendered.`,
    undefined,
    rule("missing-index-role"),
  ],
};

export function addMessage(
  messagesByDocument: Map<string, MessageArguments[]>,
  documentPath: string,
  message: MessageArguments,
): void {
  const documentMessages = messagesByDocument.get(documentPath);
  if (documentMessages) {
    documentMessages.push(message);
  } else {
    messagesByDocument.set(documentPath, [message]);
  }
}

export function emitMessages(file: VFile, documentMessages: readonly MessageArguments[]): void {
  for (const message of documentMessages) {
    file.message(...message);
  }
}
