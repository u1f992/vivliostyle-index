import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import { h } from "hastscript";
import { EXIT, visitParents } from "unist-util-visit-parents";
import type { VFile } from "vfile";

import type { BuiltIndex } from "./index-builder.ts";
import { messages } from "./messages.ts";
import { defaultHeading, renderIndex } from "./render.ts";
import type { TargetSettings } from "./settings.ts";
import { defaultComparator, sort } from "./sort.ts";
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

function collatableLanguage(language: string): boolean {
  try {
    return Intl.Collator.supportedLocalesOf(language).length !== 0;
  } catch {
    return false;
  }
}

function resolveLocales(root: hast.Root, target: hast.Element, file: VFile): Intl.LocalesArgument {
  const language = findClosestLang(root, target);
  if (language === undefined || language === "") {
    return "en";
  }
  if (collatableLanguage(language)) {
    return language;
  }
  file.message(...messages.unsupportedLanguage(language));
  return "en";
}

function findTargetElement(root: hast.Root, id: string): hast.Element | undefined {
  // Valid HTML IDs are not necessarily valid unescaped CSS ID selectors.
  return selectAll("[id]", root).find((element) => getAttribute(element, "id") === id);
}

// The role attribute holds a token list (https://www.w3.org/TR/wai-aria-1.2/#host_general_role)
// split on the host language's ASCII whitespace, which is narrower than \s.
const roleSeparator = /[\t\n\f\r ]+/;

function carriesDocIndexRole(element: hast.Element): boolean {
  const role = getAttribute(element, "role");
  return role !== null && role.split(roleSeparator).includes("doc-index");
}

export function renderDocumentIndexes(
  root: hast.Root,
  documentPath: string,
  indexes: ReadonlyMap<TargetKey, BuiltIndex>,
  settings: ReadonlyMap<TargetKey, TargetSettings>,
  file: VFile,
): void {
  for (const [targetKey, { target, index }] of indexes) {
    if (target.path !== documentPath) {
      continue;
    }
    const element = findTargetElement(root, target.id);
    if (!element) {
      file.message(...messages.missingIndexTarget(target));
      continue;
    }
    if (!carriesDocIndexRole(element)) {
      file.message(...messages.missingIndexRole(target));
      continue;
    }
    const targetSettings = settings.get(targetKey);
    const createComparator = targetSettings?.comparator ?? defaultComparator;
    const comparator = createComparator(resolveLocales(root, element, file));
    const createHeading = targetSettings?.heading ?? defaultHeading;
    renderIndex(
      sort(index, comparator),
      element,
      target.id,
      createHeading({ h }),
      targetSettings?.preamble?.({ h })(),
    );
  }
}
