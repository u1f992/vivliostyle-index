import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { h } from "hastscript";
import { EXIT, visitParents } from "unist-util-visit-parents";
import type { VFile } from "vfile";

import type { BuiltIndex } from "./index-builder.ts";
import { messages } from "./messages.ts";
import { defaultProfile, type ResolvedIndexProfile } from "./profile.ts";
import { renderIndex } from "./render.ts";
import { sort } from "./sort.ts";
import type { TargetKey } from "./target.ts";

function collatableLanguage(language: string): boolean {
  try {
    return Intl.Collator.supportedLocalesOf(language).length !== 0;
  } catch {
    return false;
  }
}

function resolveLocales(language: string | undefined, file: VFile): Intl.LocalesArgument {
  if (language === undefined || language === "") {
    return "en";
  }
  if (collatableLanguage(language)) {
    return language;
  }
  file.message(...messages.unsupportedLanguage(language));
  return "en";
}

type TargetElement = Readonly<{
  element: hast.Element;
  language: string | undefined;
}>;

function findTargetElement(root: hast.Root, id: string): TargetElement | undefined {
  // Valid HTML IDs are not necessarily valid unescaped CSS ID selectors.
  let found: TargetElement | undefined;
  visitParents(root, "element", (element, ancestors) => {
    if (getAttribute(element, "id") !== id) {
      return;
    }
    const language = [...ancestors, element]
      .reverse()
      .flatMap((ancestor) => {
        const lang = ancestor.type === "element" ? getAttribute(ancestor, "lang") : null;
        return lang === null ? [] : [lang];
      })
      .at(0);
    found = { element, language };
    return EXIT;
  });
  return found;
}

// The role attribute holds a token list (https://www.w3.org/TR/wai-aria-1.2/#host_general_role)
// split on the host language's ASCII whitespace, which is narrower than \s.
const roleSeparator = /[\t\n\f\r ]+/;

function carriesDocIndexRole(element: hast.Element): boolean {
  const role = getAttribute(element, "role");
  return role !== null && role.split(roleSeparator).includes("doc-index");
}

function resolveProfile(
  element: hast.Element,
  target: BuiltIndex["target"],
  profiles: ReadonlyMap<string, ResolvedIndexProfile>,
  file: VFile,
): ResolvedIndexProfile {
  const profileName = getAttribute(element, "data-index-profile");
  if (profileName === null) {
    return defaultProfile;
  }
  const profile = profiles.get(profileName);
  if (profile === undefined) {
    file.message(...messages.unknownIndexProfile(target, profileName));
    return defaultProfile;
  }
  return profile;
}

export function renderDocumentIndexes(
  root: hast.Root,
  documentPath: string,
  indexes: ReadonlyMap<TargetKey, BuiltIndex>,
  profiles: ReadonlyMap<string, ResolvedIndexProfile>,
  file: VFile,
): void {
  for (const { target, index } of indexes.values()) {
    if (target.path !== documentPath) {
      continue;
    }
    const found = findTargetElement(root, target.fragment);
    if (!found) {
      file.message(...messages.missingIndexTarget(target));
      continue;
    }
    const { element, language } = found;
    if (!carriesDocIndexRole(element)) {
      file.message(...messages.missingIndexRole(target));
      continue;
    }
    const profile = resolveProfile(element, target, profiles, file);
    const comparator = profile.comparator(resolveLocales(language, file));
    const sorted = sort(index, comparator);
    const renderer = profile.renderer({ h, index: sorted });
    renderIndex(sorted, element, target.fragment, renderer);
  }
}
