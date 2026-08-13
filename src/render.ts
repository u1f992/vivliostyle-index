import { parseFragment } from "./html.ts";
import type { Entry, Group, Index, Key, Locator, Reference, Subentry } from "./model.ts";
import type { Target } from "./target.ts";
import { fillSlot } from "./template.ts";

import type * as hast from "hast";
import { h } from "hastscript";

export type CreatePreamble = (createElement: typeof h) => () => hast.Element;
export type Preambles = readonly (readonly [Target, CreatePreamble])[];

export function renderIndex(
  index: Index,
  target: hast.Element,
  indexId: string,
  preamble?: hast.Element,
): void {
  target.properties = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  target.children = [
    ...(preamble === undefined ? [] : [preamble]),
    ...(index.children.length === 0 ? [] : [generateGroups(index.children, indexId)]),
  ];
}

const encodeIdSegment = (value: string): string => {
  let binary = "";
  for (const byte of new TextEncoder().encode(value)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const headingId = (indexId: string, keys: readonly Key[]): string =>
  [indexId, ...keys.flatMap(({ reading, html }) => [reading, html])].map(encodeIdSegment).join(".");

const generateGroups = (groups: Group[], indexId: string): hast.Element =>
  h(
    "ol",
    groups.map((group) =>
      h("li", [
        h("span", parseFragment(group.key.html)),
        h("ol", generateEntries(group.children, indexId, group.key)),
      ]),
    ),
  );

const generateEntries = (entries: Entry[], indexId: string, groupKey: Key): hast.Element[] =>
  entries.map((entry) =>
    h("li", { id: headingId(indexId, [groupKey, entry.key]) }, [
      h("span", parseFragment(entry.key.html)),
      generateLocators(entry.locators),
      generateReferences(entry.see, indexId),
      generateReferences(entry.seeAlso, indexId),
      generateSubentries(entry.children, indexId, [groupKey, entry.key]),
    ]),
  );

const generateSubentries = (
  subentries: Subentry[],
  indexId: string,
  parentKeys: readonly [Key, Key],
): hast.Element =>
  h(
    "ol",
    subentries.map((subentry) =>
      h("li", { id: headingId(indexId, [...parentKeys, subentry.key]) }, [
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
      const [href, children] =
        target.subentry === undefined
          ? [
              `#${headingId(indexId, [target.group, target.entry])}`,
              parseFragment(target.entry.html),
            ]
          : [
              `#${headingId(indexId, [target.group, target.entry, target.subentry])}`,
              [
                h("span", parseFragment(target.entry.html)),
                h("span"),
                h("span", parseFragment(target.subentry.html)),
              ],
            ];
      return h("li", [h("a", { href }, children)]);
    }),
  );
