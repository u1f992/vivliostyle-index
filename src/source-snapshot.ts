import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { getXPath } from "hast-util-get-xpath";
import { selectAll } from "hast-util-select";

import { parseInstruction, type ParsedInstruction } from "./instruction.ts";
import { createSourceId } from "./id.ts";
import { createLocationHref } from "./location.ts";
import { messages, type MessageArguments } from "./messages.ts";
import { documentUrl } from "./platform.ts";
import { createTarget, createTargetKey, type Target, type TargetKey } from "./target.ts";

type AttachmentBase = Readonly<{
  sourcePath: string;
  sourceId: string;
  target: Target;
  targetKey: TargetKey;
  locationHref: string;
}>;

export type Attachment = AttachmentBase & Readonly<{ instruction: ParsedInstruction }>;

export type SourceSnapshot = Readonly<{
  attachments: readonly Attachment[];
  messages: readonly MessageArguments[];
}>;

function ensureId(tree: Readonly<hast.Root>, element: hast.Element): string {
  const existingId = getAttribute(element, "id");
  if (existingId !== null) {
    return existingId;
  }

  const xpath = getXPath(tree, element);
  if (xpath === null) {
    throw new Error("getXPath() returned null for an element in the source tree");
  }
  const id = createSourceId(xpath);

  if (element.properties) {
    element.properties["id"] = id;
  } else {
    element.properties = { id };
  }
  return id;
}

export function collectSourceSnapshot(root: hast.Root, sourcePath: string): SourceSnapshot {
  const baseUrl = documentUrl(sourcePath);
  const attachments: Attachment[] = [];
  const documentMessages: MessageArguments[] = [];

  for (const element of selectAll("[data-index]", root)) {
    const reference = getAttribute(element, "data-index");
    if (reference === null) {
      continue;
    }

    let url: URL;
    let target: Target;
    try {
      url = new URL(reference, baseUrl);
      target = createTarget(url);
    } catch {
      documentMessages.push(messages.invalidIndexReference(reference));
      continue;
    }

    if (target.id === "") {
      documentMessages.push(messages.missingTargetFragment(reference));
      continue;
    }

    const instructionSource = url.searchParams.get("q");
    if (instructionSource === null) {
      documentMessages.push(messages.missingInstruction(reference));
      continue;
    }
    let instruction: ParsedInstruction;
    try {
      instruction = parseInstruction(instructionSource);
    } catch (error) {
      documentMessages.push(messages.invalidInstruction(error, instructionSource));
      continue;
    }

    const sourceId = ensureId(root, element);
    const base = {
      sourcePath,
      sourceId,
      target,
      targetKey: createTargetKey(target),
      locationHref: createLocationHref(sourcePath, target.path, sourceId),
    };
    attachments.push({ ...base, instruction });
  }

  return { attachments, messages: documentMessages };
}
