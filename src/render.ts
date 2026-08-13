import { parseFragment } from "./html.ts";
import type { Entry, Group, Index, Locator, Reference, Subentry } from "./model.ts";
import { fillSlot } from "./template.ts";

import type * as hast from "hast";
import { h } from "hastscript";

export function renderIndex(index: Index, target: hast.Element, indexId: string): void {
  target.properties = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  target.children = index.children.length === 0 ? [] : [generateGroups(index.children, indexId)];
}

const generateGroups = (groups: Group[], indexId: string): hast.Element =>
  h(
    "ol",
    groups.map((group) =>
      h("li", [
        h("span", parseFragment(group.key.html)),
        h(
          "ol",
          generateEntries(group.children, indexId, `${indexId}--${JSON.stringify(group.key)}`),
        ),
      ]),
    ),
  );

const generateEntries = (entries: Entry[], indexId: string, parentId: string): hast.Element[] =>
  entries.map((entry) => {
    const entryId = `${parentId}--${JSON.stringify(entry.key)}`;
    return h("li", { id: entryId }, [
      h("span", parseFragment(entry.key.html)),
      generateLocators(entry.locators),
      generateReferences(entry.see, indexId),
      generateReferences(entry.seeAlso, indexId),
      generateSubentries(entry.children, indexId, entryId),
    ]);
  });

const generateSubentries = (
  subentries: Subentry[],
  indexId: string,
  parentId: string,
): hast.Element =>
  h(
    "ol",
    subentries.map((subentry) =>
      h("li", { id: `${parentId}--${JSON.stringify(subentry.key)}` }, [
        h("span", parseFragment(subentry.key.html)),
        generateLocators(subentry.locators),
        generateReferences(subentry.see, indexId),
        generateReferences(subentry.seeAlso, indexId),
      ]),
    ),
  );

const generateLocators = (locators: readonly Locator[]): hast.Element =>
  h(
    "ol",
    locators.map((locator) => h("li", generateLocator(locator))),
  );

const generateLocator = ({ location, template }: Locator): hast.ElementContent[] => {
  const anchors =
    typeof location === "string"
      ? [h("a", { href: location })]
      : [h("a", { href: location.start }), h("span"), h("a", { href: location.end })];
  return template === undefined ? anchors : fillSlot(template, anchors);
};

const generateReferences = (references: readonly Reference[], indexId: string): hast.Element =>
  h(
    "ol",
    references.map(({ target }) => {
      const entryHref = `#${indexId}--${JSON.stringify(target.group)}--${JSON.stringify(target.entry)}`;
      const [href, children] =
        target.subentry === undefined
          ? [entryHref, parseFragment(target.entry.html)]
          : [
              `${entryHref}--${JSON.stringify(target.subentry)}`,
              [
                h("span", parseFragment(target.entry.html)),
                h("span"),
                h("span", parseFragment(target.subentry.html)),
              ],
            ];
      return h("li", [h("a", { href }, children)]);
    }),
  );
