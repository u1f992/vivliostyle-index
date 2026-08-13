import type { VFile } from "vfile";

import { InstructionSyntaxError } from "./instruction.ts";
import type { UnresolvedReference } from "./model.ts";
import type { Target } from "./target.ts";

export type MessageArguments = Parameters<VFile["message"]>;

const rule = (ruleId: string): string => `vivliostyle-index:${ruleId}`;
const formatTarget = (target: Target): string => `${target.documentPath}#${target.elementId}`;
const formatUnresolvedReference = ({ target, missing }: UnresolvedReference): string => {
  const parts = [`group=${JSON.stringify(target.group)}`];
  if (missing !== "group") {
    parts.push(`mainEntry=${JSON.stringify(target.mainEntry)}`);
  }
  if (missing === "subentry") {
    parts.push(`subEntry=${JSON.stringify(target.subentry)}`);
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
  invalidInstruction: (error: unknown, instructionSource: string): MessageArguments => [
    error instanceof InstructionSyntaxError
      ? error.message
      : `cannot parse index instruction: ${instructionSource}`,
    undefined,
    rule("instruction-parse-error"),
  ],
  invalidRangeEndReference: (reference: string): MessageArguments => [
    `invalid range end reference: ${reference}`,
    undefined,
    rule("invalid-range-end-reference"),
  ],
  missingRangeEnd: (target: Target): MessageArguments => [
    `range end target ${formatTarget(target)} does not exist`,
    undefined,
    rule("missing-range-end"),
  ],
  rangeEndOrder: (target: Target): MessageArguments => [
    `range end target ${formatTarget(target)} does not follow its start`,
    undefined,
    rule("range-end-order"),
  ],
  invalidReference: (reference: UnresolvedReference): MessageArguments => [
    `index does not contain ${formatUnresolvedReference(reference)}. link will likely be invalid.`,
    undefined,
    rule("invalid-reference"),
  ],
  targetNotInEntries: (target: Target): MessageArguments => [
    `index target ${formatTarget(target)} is not included in entries`,
    undefined,
    rule("target-not-in-entries"),
  ],
  missingIndexTarget: (target: Target): MessageArguments => [
    `index target ${formatTarget(target)} does not exist`,
    undefined,
    rule("missing-index-target"),
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
