import type * as hast from "hast";
import { selectAll } from "hast-util-select";

import { parseFragment } from "./html.ts";

export function countSlots(template: string): number {
  return selectAll("slot", { type: "root", children: parseFragment(template) }).length;
}

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
    return node.tagName === "slot"
      ? [...content]
      : [{ ...node, children: replaceSlots(node.children, content) }];
  });
