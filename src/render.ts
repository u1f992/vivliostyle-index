import { parseFragment } from "./html.ts";
import type { EntryBase, Group, Index, MainEntry, Subentry } from "./model.ts";

import type * as hast from "hast";
import { h } from "hastscript";

export function renderIndex(index: Index, target: hast.Element, indexId: string): void {
  target.properties = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  target.children = index.children.length === 0 ? [] : [generateGroups(index.children, indexId)];
}

const generateGroups = (groups: Group[], indexId: string): hast.Element =>
  h(
    "ol.index-groups",
    groups.map((group) =>
      h("li.index-group", [
        ...parseFragment(group.key.html),
        h(
          "ol.index-main-entries",
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
    return h("li.index-main-entry", { id: entryId }, [
      ...parseFragment(mainEntry.key.html),
      ...(mainEntry.locators.length !== 0
        ? [generateLocators(mainEntry.locators, "index-main-entry-locators")]
        : []),
      ...(mainEntry.see.length !== 0
        ? [generateReferences(mainEntry.see, "index-main-entry-see", indexId)]
        : []),
      ...(mainEntry.seeAlso.length !== 0
        ? [generateReferences(mainEntry.seeAlso, "index-main-entry-see-also", indexId)]
        : []),
      ...(mainEntry.children.length !== 0
        ? [generateSubentries(mainEntry.children, indexId, entryId)]
        : []),
    ]);
  });

const generateSubentries = (
  subentries: Subentry[],
  indexId: string,
  parentId: string,
): hast.Element =>
  h(
    "ol.index-subentries",
    subentries.map((subentry) =>
      h("li.index-subentry", { id: `${parentId}--${JSON.stringify(subentry.key)}` }, [
        ...parseFragment(subentry.key.html),
        ...(subentry.locators.length !== 0
          ? [generateLocators(subentry.locators, "index-subentry-locators")]
          : []),
        ...(subentry.see.length !== 0
          ? [generateReferences(subentry.see, "index-subentry-see", indexId)]
          : []),
        ...(subentry.seeAlso.length !== 0
          ? [generateReferences(subentry.seeAlso, "index-subentry-see-also", indexId)]
          : []),
      ]),
    ),
  );

const generateLocators = (locators: EntryBase["locators"], className: string): hast.Element =>
  h(
    "ol",
    { className },
    locators.map(({ locator, important }) =>
      h(
        "li",
        important ? { className: "important" } : {},
        typeof locator === "string"
          ? [h("a", { href: locator })]
          : [
              h("a", { href: locator.start }),
              h("span", { className: className + "-separator" }),
              h("a", { href: locator.end }),
            ],
      ),
    ),
  );

const generateReferences = (
  references: EntryBase["see"],
  className: string,
  indexId: string,
): hast.Element =>
  h(
    "ol",
    { className },
    references.map(({ target }) => {
      const mainEntryHref = `#${indexId}--${JSON.stringify(target.group)}--${JSON.stringify(target.mainEntry)}`;
      const [href, children] =
        target.subentry === undefined
          ? [mainEntryHref, parseFragment(target.mainEntry.html)]
          : [
              `${mainEntryHref}--${JSON.stringify(target.subentry)}`,
              [
                h("span", parseFragment(target.mainEntry.html)),
                h("span", { className: className + "-separator" }),
                h("span", parseFragment(target.subentry.html)),
              ],
            ];
      return h("li", [h("a", { href }, children)]);
    }),
  );
