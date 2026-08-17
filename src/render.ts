import { parseFragment } from "./html.ts";
import type {
  EntryAddress,
  Key,
  Locator,
  ReadonlyEntry,
  ReadonlyGroup,
  ReadonlyIndex,
  ReadonlySubentry,
  Xref,
  XrefType,
} from "./model.ts";
import { fillSlot } from "./template.ts";

import type * as hast from "hast";
import { h } from "hastscript";

type Elem = hast.Element;
type ElemContent = hast.ElementContent;
type RoleProperties<Role extends string> = Readonly<{ dataIndexRole: Role }>;
type IdProperties = Readonly<{ id: string }>;
type IndexProperties = Readonly<hast.Properties & { dataIndexResult: string }>;

export type HeadingRenderer = (contents: ElemContent[]) => ElemContent[];

export type EntryRendererBase = Readonly<{
  heading?: HeadingRenderer;
  locatorAnchors?: (context: { locator: Locator }) => ElemContent[];
  locator?(context: {
    locator: Locator;
    anchors: ElemContent[];
    children: ElemContent[];
  }): ElemContent[];
  locatorList?(parts: {
    properties: RoleProperties<"locator-list">;
    locators: { locator: Locator; children: ElemContent[] }[];
  }): ElemContent[];
  xrefAnchor?: (context: {
    xref: Xref;
    type: XrefType;
    href: string;
    contents: ElemContent[];
  }) => ElemContent[];
  xref?(context: {
    xref: Xref;
    type: XrefType;
    anchors: ElemContent[];
    children: ElemContent[];
  }): ElemContent[];
  xrefPreferredList?(parts: {
    properties: RoleProperties<"xref-preferred">;
    xrefs: { xref: Xref; children: ElemContent[] }[];
  }): ElemContent[];
  xrefRelatedList?(parts: {
    properties: RoleProperties<"xref-related">;
    xrefs: { xref: Xref; children: ElemContent[] }[];
  }): ElemContent[];
}>;

export type SubentryRenderer = EntryRendererBase &
  Readonly<{
    self?(parts: {
      properties: IdProperties;
      heading: ElemContent[];
      locatorList: ElemContent[];
      xrefPreferredList: ElemContent[];
      xrefRelatedList: ElemContent[];
    }): ElemContent[];
  }>;

export type EntryRenderer = EntryRendererBase &
  Readonly<{
    subentry?: (context: { subentry: ReadonlySubentry; id: string }) => SubentryRenderer;
    subentryList?(parts: {
      properties: RoleProperties<"subentry-list">;
      subentries: { subentry: ReadonlySubentry; children: ElemContent[] }[];
    }): ElemContent[];
    self?(parts: {
      properties: IdProperties;
      heading: ElemContent[];
      locatorList: ElemContent[];
      xrefPreferredList: ElemContent[];
      xrefRelatedList: ElemContent[];
      subentryList: ElemContent[];
    }): ElemContent[];
  }>;

export type GroupRenderer = Readonly<{
  heading?: HeadingRenderer;
  entry?: (context: { entry: ReadonlyEntry; id: string }) => EntryRenderer;
  entryList?(parts: {
    properties: RoleProperties<"entry-list">;
    entries: { entry: ReadonlyEntry; children: ElemContent[] }[];
  }): ElemContent[];
  self?(parts: {
    properties: RoleProperties<"group">;
    heading: ElemContent[];
    entryList: ElemContent[];
  }): ElemContent[];
}>;

export type IndexRenderer = Readonly<{
  preamble?: () => ElemContent[];
  group?: (context: { group: ReadonlyGroup }) => GroupRenderer;
  groupList?(parts: {
    properties: RoleProperties<"group-list">;
    groups: { group: ReadonlyGroup; children: ElemContent[] }[];
  }): ElemContent[];
  self?(parts: {
    properties: IndexProperties;
    preamble: ElemContent[];
    groupList: ElemContent[];
  }): { properties: hast.Properties; children: ElemContent[] };
}>;

export type CreateRenderer = (context: { h: typeof h; index: ReadonlyIndex }) => IndexRenderer;

export function renderIndex(
  index: ReadonlyIndex,
  target: Elem,
  indexId: string,
  renderer: IndexRenderer,
): void {
  const preamble = renderer.preamble?.() ?? [];
  const groups = index.children.map((group) => ({
    group,
    children: renderGroup(group, indexId, renderer.group?.({ group }) ?? {}),
  }));
  const groupListProperties = { dataIndexRole: "group-list" } as const;
  const groupList =
    renderer.groupList?.({ properties: groupListProperties, groups }) ??
    (groups.length === 0
      ? []
      : [
          h(
            "div",
            groupListProperties,
            groups.flatMap(({ children }) => children),
          ),
        ]);
  const indexProperties = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  const { properties, children } = renderer.self?.({
    properties: indexProperties,
    preamble,
    groupList,
  }) ?? {
    properties: indexProperties,
    children: [...preamble, ...groupList],
  };
  target.properties = properties;
  target.children = children;
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

const renderHeading = (key: Key, heading: HeadingRenderer | undefined): ElemContent[] => {
  const contents = parseFragment(key.html);
  return heading?.(contents) ?? [h("span", contents)];
};

const renderGroup = (
  group: ReadonlyGroup,
  indexId: string,
  renderer: GroupRenderer,
): ElemContent[] => {
  const heading = renderHeading(group.key, renderer.heading);
  const entries = group.children.map((entry) => {
    const id = headingId(indexId, [group.key, entry.key]);
    return {
      entry,
      children: renderEntry(entry, id, indexId, group.key, renderer.entry?.({ entry, id }) ?? {}),
    };
  });
  const entryListProperties = { dataIndexRole: "entry-list" } as const;
  const entryList = renderer.entryList?.({ properties: entryListProperties, entries }) ?? [
    h(
      "ul",
      entryListProperties,
      entries.flatMap(({ children }) => children),
    ),
  ];
  const properties = { dataIndexRole: "group" } as const;
  return (
    renderer.self?.({ properties, heading, entryList }) ?? [
      h("section", properties, [...heading, ...entryList]),
    ]
  );
};

const renderEntry = (
  entry: ReadonlyEntry,
  id: string,
  indexId: string,
  groupKey: Key,
  renderer: EntryRenderer,
): ElemContent[] => {
  const heading = renderHeading(entry.key, renderer.heading);
  const locatorList = renderLocatorList(entry.locators, renderer);
  const xrefPreferredList = renderXrefList(entry.xrefPreferred, "preferred", indexId, renderer);
  const xrefRelatedList = renderXrefList(entry.xrefRelated, "related", indexId, renderer);
  const subentries = entry.children.map((subentry) => {
    const subentryId = headingId(indexId, [groupKey, entry.key, subentry.key]);
    return {
      subentry,
      children: renderSubentry(
        subentry,
        subentryId,
        indexId,
        renderer.subentry?.({ subentry, id: subentryId }) ?? {},
      ),
    };
  });
  const subentryListProperties = { dataIndexRole: "subentry-list" } as const;
  const subentryList = renderer.subentryList?.({
    properties: subentryListProperties,
    subentries,
  }) ?? [
    h(
      "ul",
      subentryListProperties,
      subentries.flatMap(({ children }) => children),
    ),
  ];
  const properties = { id };
  return (
    renderer.self?.({
      properties,
      heading,
      locatorList,
      xrefPreferredList,
      xrefRelatedList,
      subentryList,
    }) ?? [
      h("li", properties, [
        ...heading,
        ...locatorList,
        ...xrefPreferredList,
        ...xrefRelatedList,
        ...subentryList,
      ]),
    ]
  );
};

const renderSubentry = (
  subentry: ReadonlySubentry,
  id: string,
  indexId: string,
  renderer: SubentryRenderer,
): ElemContent[] => {
  const heading = renderHeading(subentry.key, renderer.heading);
  const locatorList = renderLocatorList(subentry.locators, renderer);
  const xrefPreferredList = renderXrefList(subentry.xrefPreferred, "preferred", indexId, renderer);
  const xrefRelatedList = renderXrefList(subentry.xrefRelated, "related", indexId, renderer);
  const properties = { id };
  return (
    renderer.self?.({ properties, heading, locatorList, xrefPreferredList, xrefRelatedList }) ?? [
      h("li", properties, [...heading, ...locatorList, ...xrefPreferredList, ...xrefRelatedList]),
    ]
  );
};

const renderLocatorList = (
  locators: readonly Locator[],
  renderer: EntryRendererBase,
): ElemContent[] => {
  const rendered = locators.map((locator) => ({
    locator,
    children: renderLocatorItem(locator, renderer),
  }));
  const properties = { dataIndexRole: "locator-list" } as const;
  return (
    renderer.locatorList?.({ properties, locators: rendered }) ?? [
      h(
        "ol",
        properties,
        rendered.flatMap(({ children }) => children),
      ),
    ]
  );
};

const defaultLocatorAnchors = ({ location }: Locator): ElemContent[] =>
  location.type === "page"
    ? [h("a", { href: location.href })]
    : [
        h("a", { dataIndexRole: "range", href: location.start }, [
          h("span", { dataIndexRangeStart: location.start }),
          h("span", { dataIndexRole: "range-separator" }),
          h("span", { dataIndexRangeEnd: location.end }),
        ]),
      ];

const renderLocatorItem = (locator: Locator, renderer: EntryRendererBase): ElemContent[] => {
  const anchors = renderer.locatorAnchors?.({ locator }) ?? defaultLocatorAnchors(locator);
  const children = locator.template === undefined ? anchors : fillSlot(locator.template, anchors);
  return renderer.locator?.({ locator, anchors, children }) ?? [h("li", children)];
};

const xrefId = (indexId: string, { group, entry, subentry }: EntryAddress): string =>
  subentry === undefined
    ? headingId(indexId, [group, entry])
    : headingId(indexId, [group, entry, subentry]);

const renderXrefList = (
  xrefs: readonly Xref[],
  type: XrefType,
  indexId: string,
  renderer: EntryRendererBase,
): ElemContent[] => {
  const rendered = xrefs.map((xref) => ({
    xref,
    children: renderXrefItem(xref, type, indexId, renderer),
  }));
  if (type === "preferred") {
    const properties = { dataIndexRole: "xref-preferred" } as const;
    return (
      renderer.xrefPreferredList?.({ properties, xrefs: rendered }) ?? [
        h(
          "ul",
          properties,
          rendered.flatMap(({ children }) => children),
        ),
      ]
    );
  }
  const properties = { dataIndexRole: "xref-related" } as const;
  return (
    renderer.xrefRelatedList?.({ properties, xrefs: rendered }) ?? [
      h(
        "ul",
        properties,
        rendered.flatMap(({ children }) => children),
      ),
    ]
  );
};

const defaultXrefAnchor = (href: string, contents: ElemContent[]): ElemContent[] => [
  h("a", { href }, contents),
];

const renderXrefItem = (
  xref: Xref,
  type: XrefType,
  indexId: string,
  renderer: EntryRendererBase,
): ElemContent[] => {
  const { target, template } = xref;
  const href = `#${xrefId(indexId, target)}`;
  const contents =
    target.subentry === undefined
      ? parseFragment(target.entry.html)
      : [
          h("span", parseFragment(target.entry.html)),
          h("span"),
          h("span", parseFragment(target.subentry.html)),
        ];
  const anchors =
    renderer.xrefAnchor?.({ xref, type, href, contents }) ?? defaultXrefAnchor(href, contents);
  const children = template === undefined ? anchors : fillSlot(template, anchors);
  return renderer.xref?.({ xref, type, anchors, children }) ?? [h("li", children)];
};
