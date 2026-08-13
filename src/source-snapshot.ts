import { pathToFileURL } from "node:url";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { getXPath } from "hast-util-get-xpath";
import { selectAll } from "hast-util-select";

import { parseInstruction, type ParsedInstruction } from "./instruction.ts";
import { createLocatorHref } from "./locator.ts";
import { messages, type MessageArguments } from "./messages.ts";
import {
  createTarget,
  createTargetKey,
  resolveTarget,
  type Target,
  type TargetKey,
} from "./target.ts";

export type Attachment = Readonly<{
  sourcePath: string;
  sourceElementId: string;
  target: Target;
  targetKey: TargetKey;
  instruction: ParsedInstruction;
  locatorHref: string;
  rangeEndTarget?: Target;
}>;

export type SourceSnapshot = Readonly<{
  attachments: readonly Attachment[];
  messages: readonly MessageArguments[];
  elementIds: readonly string[];
}>;

function ensureId(tree: Readonly<hast.Root>, element: hast.Element): string {
  let id = getAttribute(element, "id");
  if (id !== null) {
    return id;
  }

  id = getXPath(tree, element);
  if (id === null) {
    throw new Error("id === null: won't happen. it's likely a bug in getXPath()");
  }

  if (element.properties) {
    element.properties["id"] = id;
  } else {
    element.properties = { id };
  }
  return id;
}

export function collectSourceSnapshot(root: hast.Root, sourcePath: string): SourceSnapshot {
  const baseUrl = pathToFileURL(sourcePath);
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

    const instructionSource = url.searchParams.get("q");
    if (instructionSource === null) {
      continue;
    }
    let instruction: ParsedInstruction;
    try {
      instruction = parseInstruction(instructionSource);
    } catch (error) {
      documentMessages.push(messages.invalidInstruction(error, instructionSource));
      continue;
    }

    const sourceElementId = ensureId(root, element);
    let rangeEndTarget: Target | undefined;
    if (instruction.type === "range") {
      try {
        rangeEndTarget = resolveTarget(instruction.endReference, baseUrl);
        if (rangeEndTarget.elementId === "") {
          throw new TypeError();
        }
      } catch {
        documentMessages.push(messages.invalidRangeEndReference(instruction.endReference));
        continue;
      }
    }
    attachments.push({
      sourcePath,
      sourceElementId,
      target,
      targetKey: createTargetKey(target),
      instruction,
      locatorHref: createLocatorHref(sourcePath, target.documentPath, sourceElementId),
      ...(rangeEndTarget === undefined ? {} : { rangeEndTarget }),
    });
  }

  const elementIds = selectAll("[id]", root).flatMap((element) => {
    const id = getAttribute(element, "id");
    return id === null ? [] : [id];
  });
  return { attachments, messages: documentMessages, elementIds };
}
