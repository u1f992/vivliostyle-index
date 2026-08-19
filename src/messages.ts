import type { VFile } from "vfile";

import { InstructionSyntaxError } from "./instruction.ts";
import type { EntryAddress, UnresolvedXref } from "./model.ts";
import type { Target } from "./target.ts";

export type MessageArguments = Parameters<VFile["message"]>;

const rule = (ruleId: string): string => `vivliostyle-index:${ruleId}`;
const formatTarget = (target: Target): string => `${target.path}#${target.fragment}`;
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
  unmatchedRangeStart: (target: Target, address: EntryAddress): MessageArguments => [
    `range start for entry ${formatEntryAddress(address)} of index target ${formatTarget(target)} has no matching range end. the range start is treated as a page locator.`,
    undefined,
    rule("unmatched-range-start"),
  ],
  unmatchedRangeEnd: (target: Target, address: EntryAddress): MessageArguments => [
    `range end for entry ${formatEntryAddress(address)} of index target ${formatTarget(target)} has no matching range start. the range end is treated as a page locator.`,
    undefined,
    rule("unmatched-range-end"),
  ],
  invalidXref: (xref: UnresolvedXref): MessageArguments => [
    `index does not contain ${formatUnresolvedXref(xref)}. the cross-reference target will not resolve.`,
    undefined,
    rule("invalid-xref"),
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
