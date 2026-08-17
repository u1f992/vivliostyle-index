import type * as hast from "hast";

import { parseFragment } from "./html.ts";

export const identityTemplate = "<slot></slot>";

export function fillSlot(
  template: string,
  content: readonly hast.ElementContent[],
): hast.ElementContent[] {
  return replaceSlots(parseFragment(template), content, { hasInsertedContent: false });
}

const replaceSlots = (
  nodes: readonly hast.ElementContent[],
  content: readonly hast.ElementContent[],
  state: { hasInsertedContent: boolean },
): hast.ElementContent[] =>
  nodes.flatMap((node) => {
    if (node.type !== "element") {
      return [node];
    }
    if (node.tagName === "slot") {
      // hast consumers generally expect each occurrence to be a distinct object; sharing a node would make a properties change at one slot affect the others.
      const inserted = state.hasInsertedContent ? cloneElementContent(content) : [...content];
      state.hasInsertedContent = true;
      return inserted;
    }
    return [{ ...node, children: replaceSlots(node.children, content, state) }];
  });

const cloneElementContent = (content: readonly hast.ElementContent[]): hast.ElementContent[] =>
  content.map(cloneElementContentNode);

const cloneElementContentNode = (node: hast.ElementContent): hast.ElementContent =>
  node.type === "element" ? cloneElement(node) : cloneLeaf(node);

const cloneRootContentNode = (node: hast.RootContent): hast.RootContent =>
  node.type === "element" ? cloneElement(node) : cloneLeaf(node);

const cloneElement = (element: hast.Element): hast.Element => ({
  ...element,
  data: cloneData(element.data),
  position: clonePosition(element.position),
  properties: cloneProperties(element.properties),
  children: element.children.map(cloneElementContentNode),
  content:
    element.content === undefined
      ? undefined
      : {
          ...element.content,
          data: cloneData(element.content.data),
          position: clonePosition(element.content.position),
          children: element.content.children.map(cloneRootContentNode),
        },
});

const cloneLeaf = <Node extends Exclude<hast.RootContent, hast.Element>>(node: Node): Node =>
  ({
    ...node,
    data: cloneData(node.data),
    position: clonePosition(node.position),
  }) as Node;

const cloneData = (data: hast.Node["data"]): hast.Node["data"] =>
  data === undefined ? undefined : { ...data };

const clonePosition = (position: hast.Node["position"]): hast.Node["position"] =>
  position === undefined
    ? undefined
    : {
        start: { ...position.start },
        end: { ...position.end },
        indent: position.indent === undefined ? undefined : [...position.indent],
      };

const cloneProperties = (properties: hast.Properties | undefined): hast.Properties | undefined =>
  properties === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(properties).map(([name, value]) => [
          name,
          Array.isArray(value) ? [...value] : value,
        ]),
      );
