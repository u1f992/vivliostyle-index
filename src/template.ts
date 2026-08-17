import type * as hast from "hast";

import { parseFragment } from "./html.ts";

export const identityTemplate = "<slot></slot>";

export function fillSlot(
  template: string,
  content: readonly hast.ElementContent[],
): hast.ElementContent[] {
  return replaceSlots(parseFragment(template), content);
}

const replaceSlots = (
  nodes: readonly hast.ElementContent[],
  content: readonly hast.ElementContent[],
): hast.ElementContent[] =>
  nodes.flatMap((node) => {
    if (node.type !== "element") {
      return [node];
    }
    if (node.tagName === "slot") {
      return [...content];
    }
    return [{ ...node, children: replaceSlots(node.children, content) }];
  });
