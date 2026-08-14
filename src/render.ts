import { parseFragment } from "./html.ts";
import type { Entry, Group, Index, Key, Locator, Subentry, Xref, XrefType } from "./model.ts";
import type { Target } from "./target.ts";
import { fillSlot } from "./template.ts";

import type * as hast from "hast";
import { h } from "hastscript";

export type CreatePreamble = (createElement: typeof h) => () => hast.Element;
export type Preambles = readonly (readonly [Target, CreatePreamble])[];

export type HeadingTier = "group" | "entry" | "subentry";
export type HeadingGenerator = (
  tier: HeadingTier,
  props: Readonly<hast.Properties>,
  children: readonly hast.ElementContent[],
) => hast.Element;
export type CreateHeading = (createElement: typeof h) => HeadingGenerator;
export type Headings = readonly (readonly [Target, CreateHeading])[];

export const defaultHeading: CreateHeading = (createElement) => (_tier, props, children) =>
  createElement("span", { ...props }, [...children]);

export function renderIndex(
  index: Index,
  target: hast.Element,
  indexId: string,
  heading: HeadingGenerator,
  preamble?: hast.Element,
): void {
  target.properties = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  target.children = [
    ...(preamble === undefined ? [] : [preamble]),
    ...(index.children.length === 0 ? [] : [generateGroups(index.children, indexId, heading)]),
  ];
}

const idSegmentEncoder = new TextEncoder();

const encodeIdSegment = (value: string): string => {
  let binary = "";
  for (const byte of idSegmentEncoder.encode(value)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const headingId = (indexId: string, keys: readonly Key[]): string =>
  [indexId, ...keys.flatMap(({ reading, html }) => [reading, html])].map(encodeIdSegment).join(".");

const generateGroups = (
  groups: Group[],
  indexId: string,
  heading: HeadingGenerator,
): hast.Element =>
  h(
    "div",
    { dataIndexRole: "group-list" },
    groups.map((group) =>
      h("section", { dataIndexRole: "group" }, [
        heading("group", {}, parseFragment(group.key.html)),
        h(
          "ul",
          { dataIndexRole: "entry-list" },
          generateEntries(group.children, indexId, group.key, heading),
        ),
      ]),
    ),
  );

const generateEntries = (
  entries: Entry[],
  indexId: string,
  groupKey: Key,
  heading: HeadingGenerator,
): hast.Element[] =>
  entries.map((entry) =>
    h("li", { id: headingId(indexId, [groupKey, entry.key]) }, [
      heading("entry", {}, parseFragment(entry.key.html)),
      generateLocators(entry.locators),
      generateXrefs(entry.xrefPreferred, indexId, "preferred"),
      generateXrefs(entry.xrefRelated, indexId, "related"),
      generateSubentries(entry.children, indexId, [groupKey, entry.key], heading),
    ]),
  );

const generateSubentries = (
  subentries: Subentry[],
  indexId: string,
  parentKeys: readonly [Key, Key],
  heading: HeadingGenerator,
): hast.Element =>
  h(
    "ul",
    { dataIndexRole: "subentry-list" },
    subentries.map((subentry) =>
      h("li", { id: headingId(indexId, [...parentKeys, subentry.key]) }, [
        heading("subentry", {}, parseFragment(subentry.key.html)),
        generateLocators(subentry.locators),
        generateXrefs(subentry.xrefPreferred, indexId, "preferred"),
        generateXrefs(subentry.xrefRelated, indexId, "related"),
      ]),
    ),
  );

const generateLocators = (locators: readonly Locator[]): hast.Element =>
  h(
    "ol",
    { dataIndexRole: "locator-list" },
    locators.map((locator) => h("li", generateLocator(locator))),
  );

const generateLocator = ({ location, template }: Locator): hast.ElementContent[] => {
  const anchors =
    location.type === "page"
      ? [h("a", { href: location.href })]
      : [h("a", { href: location.start }), h("span"), h("a", { href: location.end })];
  return template === undefined ? anchors : fillSlot(template, anchors);
};

const generateXrefs = (xrefs: readonly Xref[], indexId: string, type: XrefType): hast.Element =>
  h(
    "ul",
    { dataIndexRole: `xref-${type}` },
    xrefs.map(({ target, template }) => {
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
      const anchor = h("a", { href }, children);
      return h("li", template === undefined ? [anchor] : fillSlot(template, [anchor]));
    }),
  );
