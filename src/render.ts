import { parseFragment } from "./html.ts";
import type { EntryBase, Group, Index, LocatorEntry, MainEntry, Subentry } from "./model.ts";
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
          generateMainEntries(group.children, indexId, `${indexId}--${JSON.stringify(group.key)}`),
        ),
      ]),
    ),
  );

const generateMainEntries = (
  mainEntries: MainEntry[],
  indexId: string,
  parentId: string,
): hast.Element[] =>
  mainEntries.map((mainEntry) => {
    const entryId = `${parentId}--${JSON.stringify(mainEntry.key)}`;
    return h("li", { id: entryId }, [
      h("span", parseFragment(mainEntry.key.html)),
      generateLocators(mainEntry.locators),
      generateReferences(mainEntry.see, indexId),
      generateReferences(mainEntry.seeAlso, indexId),
      generateSubentries(mainEntry.children, indexId, entryId),
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

const generateLocators = (locators: EntryBase["locators"]): hast.Element =>
  h(
    "ol",
    locators.map((locatorEntry) => h("li", generateLocator(locatorEntry))),
  );

const generateLocator = ({ locator, template }: LocatorEntry): hast.ElementContent[] => {
  const anchors =
    typeof locator === "string"
      ? [h("a", { href: locator })]
      : [h("a", { href: locator.start }), h("span"), h("a", { href: locator.end })];
  return template === undefined ? anchors : fillSlot(template, anchors);
};

const generateReferences = (references: EntryBase["see"], indexId: string): hast.Element =>
  h(
    "ol",
    references.map(({ target }) => {
      const mainEntryHref = `#${indexId}--${JSON.stringify(target.group)}--${JSON.stringify(target.mainEntry)}`;
      const [href, children] =
        target.subentry === undefined
          ? [mainEntryHref, parseFragment(target.mainEntry.html)]
          : [
              `${mainEntryHref}--${JSON.stringify(target.subentry)}`,
              [
                h("span", parseFragment(target.mainEntry.html)),
                h("span"),
                h("span", parseFragment(target.subentry.html)),
              ],
            ];
      return h("li", [h("a", { href }, children)]);
    }),
  );
