import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import { EXIT, visitParents } from "unist-util-visit-parents";
import type { VFile } from "vfile";

import type { BuiltIndex } from "./index-builder.ts";
import { messages } from "./messages.ts";
import { renderIndex } from "./render.ts";
import { defaultComparator, sort, type IndexComparator } from "./sort.ts";
import type { TargetKey } from "./target.ts";

function findClosestLang(root: hast.Root, target: hast.Element): string | undefined {
  let closestLang: string | undefined;
  visitParents(root, "element", (element, ancestors) => {
    if (element !== target) {
      return;
    }
    closestLang = [...ancestors, element]
      .reverse()
      .flatMap((ancestor) => {
        const lang = ancestor.type === "element" ? getAttribute(ancestor, "lang") : null;
        return lang === null ? [] : [lang];
      })
      .at(0);
    return EXIT;
  });
  return closestLang;
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
