import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import type { VFile } from "vfile";

import type { BuiltIndex } from "./index-builder.ts";
import { messages } from "./messages.ts";
import { renderIndex } from "./render.ts";
import { defaultComparator, sort, type IndexComparator } from "./sort.ts";
import type { TargetKey } from "./target.ts";

function findClosestLang(
  root: hast.Root | hast.Element,
  target: hast.Element,
  inheritedLang?: string,
): string | undefined {
  const lang =
    root.type === "element" ? (getAttribute(root, "lang") ?? inheritedLang) : inheritedLang;
  if (root === target) {
    return lang;
  }
  for (const child of root.children) {
    if (child.type !== "element") {
      continue;
    }
    const found = findClosestLang(child, target, lang);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function findTargetElement(root: hast.Root, elementId: string): hast.Element | undefined {
  return selectAll("[id]", root).find((element) => getAttribute(element, "id") === elementId);
}

export function renderDocumentIndexes(
  root: hast.Root,
  documentPath: string,
  indexes: ReadonlyMap<TargetKey, BuiltIndex>,
  comparators: ReadonlyMap<TargetKey, IndexComparator>,
  file: VFile,
): void {
  for (const [targetKey, { target, index }] of indexes) {
    if (target.documentPath !== documentPath) {
      continue;
    }
    const element = findTargetElement(root, target.elementId);
    if (!element) {
      file.message(...messages.missingIndexTarget(target));
      continue;
    }
    const comparator =
      comparators.get(targetKey) ?? defaultComparator(findClosestLang(root, element));
    renderIndex(sort(index, comparator), element, target.elementId);
  }
}
