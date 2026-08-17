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
type Content = ElemContent[];
type ElementProperties = Readonly<hast.Properties>;
type RoleProperties<Role extends string> = Readonly<hast.Properties & { dataIndexRole: Role }>;
type IdProperties = Readonly<hast.Properties & { id: string }>;
type IndexProperties = Readonly<hast.Properties & { dataIndexResult: string }>;

export type RenderedGroup = Readonly<{ group: Key; content: Content }>;
export type RenderedEntry = Readonly<{ entry: Key; content: Content }>;
export type RenderedSubentry = Readonly<{ subentry: Key; content: Content }>;
export type RenderedLocator = Readonly<{ locator: Locator; content: Content }>;
export type RenderedXref = Readonly<{ xref: Xref; content: Content }>;

export type PreambleRenderer = () => Content;

export type HeadingRenderer = (parts: {
  properties: ElementProperties;
  contents: Content;
}) => Content;

export type LocatorRenderer = (parts: { locator: Locator }) => Content;

export type XrefRenderer = (parts: {
  xref: Xref;
  type: XrefType;
  href: string;
  contents: Content;
}) => Content;

export type LocatorListRenderer = Readonly<{
  locator?: LocatorRenderer;
  self?(parts: { locators: readonly RenderedLocator[] }): Content;
}>;

export type XrefListRenderer = Readonly<{
  xref?: XrefRenderer;
  self?(parts: { xrefs: readonly RenderedXref[] }): Content;
}>;

export type SubentryRenderer = Readonly<{
  heading?: HeadingRenderer;
  locatorList?(context: { properties: RoleProperties<"locator-list"> }): LocatorListRenderer;
  xrefPreferredList?(context: {
    type: "preferred";
    properties: RoleProperties<"xref-preferred">;
  }): XrefListRenderer;
  xrefRelatedList?(context: {
    type: "related";
    properties: RoleProperties<"xref-related">;
  }): XrefListRenderer;
  self?(parts: {
    heading: Content;
    locatorList: Content;
    xrefPreferredList: Content;
    xrefRelatedList: Content;
  }): Content;
}>;

export type SubentryListRenderer = Readonly<{
  subentry?(context: { subentry: Key; properties: IdProperties }): SubentryRenderer;
  self?(parts: { subentries: readonly RenderedSubentry[] }): Content;
}>;

export type EntryRenderer = Readonly<{
  heading?: HeadingRenderer;
  locatorList?(context: { properties: RoleProperties<"locator-list"> }): LocatorListRenderer;
  xrefPreferredList?(context: {
    type: "preferred";
    properties: RoleProperties<"xref-preferred">;
  }): XrefListRenderer;
  xrefRelatedList?(context: {
    type: "related";
    properties: RoleProperties<"xref-related">;
  }): XrefListRenderer;
  subentryList?(context: { properties: RoleProperties<"subentry-list"> }): SubentryListRenderer;
  self?(parts: {
    heading: Content;
    locatorList: Content;
    xrefPreferredList: Content;
    xrefRelatedList: Content;
    subentryList: Content;
  }): Content;
}>;

export type EntryListRenderer = Readonly<{
  entry?(context: { entry: Key; properties: IdProperties }): EntryRenderer;
  self?(parts: { entries: readonly RenderedEntry[] }): Content;
}>;

export type GroupRenderer = Readonly<{
  heading?: HeadingRenderer;
  entryList?(context: { properties: RoleProperties<"entry-list"> }): EntryListRenderer;
  self?(parts: { heading: Content; entryList: Content }): Content;
}>;

export type GroupListRenderer = Readonly<{
  group?(context: { group: Key; properties: RoleProperties<"group"> }): GroupRenderer;
  self?(parts: { groups: readonly RenderedGroup[] }): Content;
}>;

export type IndexRenderer = Readonly<{
  preamble?: PreambleRenderer;
  groupList?(context: { properties: RoleProperties<"group-list"> }): GroupListRenderer;
  self?(parts: { properties: IndexProperties; preamble: Content; groupList: Content }): {
    properties: hast.Properties;
    children: Content;
  };
}>;

export type CreateRenderer = (context: { h: typeof h; index: ReadonlyIndex }) => IndexRenderer;

export function renderIndex(
  index: ReadonlyIndex,
  target: Elem,
  indexId: string,
  renderer: IndexRenderer,
): void {
  const preamble = renderer.preamble?.() ?? [];
  const groupListProperties = { dataIndexRole: "group-list" } as const;
  const groupListRenderer = renderer.groupList?.({ properties: groupListProperties }) ?? {};
  const groups = index.children.map((group) => {
    const properties = { dataIndexRole: "group" } as const;
    const groupRenderer = groupListRenderer.group?.({ group: group.key, properties }) ?? {};
    return {
      group: group.key,
      content: renderGroup(group, properties, indexId, groupRenderer),
    };
  });
  const groupList =
    groupListRenderer.self?.({ groups }) ??
    (groups.length === 0
      ? []
      : [
          h(
            "div",
            groupListProperties,
            groups.flatMap(({ content }) => content),
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

type HeadingOwner = Readonly<{ heading?: HeadingRenderer }>;

const renderHeading = (key: Key, renderer: HeadingOwner): Content => {
  const properties = {};
  const contents = parseFragment(key.html);
  return renderer.heading?.({ properties, contents }) ?? [h("span", properties, contents)];
};

const renderGroup = (
  group: ReadonlyGroup,
  properties: RoleProperties<"group">,
  indexId: string,
  renderer: GroupRenderer,
): Content => {
  const heading = renderHeading(group.key, renderer);
  const entryListProperties = { dataIndexRole: "entry-list" } as const;
  const entryListRenderer = renderer.entryList?.({ properties: entryListProperties }) ?? {};
  const entries = group.children.map((entry) => {
    const entryProperties = { id: headingId(indexId, [group.key, entry.key]) };
    const entryRenderer =
      entryListRenderer.entry?.({ entry: entry.key, properties: entryProperties }) ?? {};
    return {
      entry: entry.key,
      content: renderEntry(entry, entryProperties, indexId, group.key, entryRenderer),
    };
  });
  const entryList = entryListRenderer.self?.({ entries }) ?? [
    h(
      "ul",
      entryListProperties,
      entries.flatMap(({ content }) => content),
    ),
  ];
  return (
    renderer.self?.({ heading, entryList }) ?? [
      h("section", properties, [...heading, ...entryList]),
    ]
  );
};

const renderEntry = (
  entry: ReadonlyEntry,
  properties: IdProperties,
  indexId: string,
  groupKey: Key,
  renderer: EntryRenderer,
): Content => {
  const heading = renderHeading(entry.key, renderer);
  const locatorList = renderLocatorList(entry.locators, renderer);
  const xrefPreferredList = renderPreferredXrefList(entry.xrefPreferred, indexId, renderer);
  const xrefRelatedList = renderRelatedXrefList(entry.xrefRelated, indexId, renderer);
  const subentryListProperties = { dataIndexRole: "subentry-list" } as const;
  const subentryListRenderer =
    renderer.subentryList?.({ properties: subentryListProperties }) ?? {};
  const subentries = entry.children.map((subentry) => {
    const subentryProperties = {
      id: headingId(indexId, [groupKey, entry.key, subentry.key]),
    };
    const subentryRenderer =
      subentryListRenderer.subentry?.({
        subentry: subentry.key,
        properties: subentryProperties,
      }) ?? {};
    return {
      subentry: subentry.key,
      content: renderSubentry(subentry, subentryProperties, indexId, subentryRenderer),
    };
  });
  const subentryList = subentryListRenderer.self?.({ subentries }) ?? [
    h(
      "ul",
      subentryListProperties,
      subentries.flatMap(({ content }) => content),
    ),
  ];
  return (
    renderer.self?.({
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
  properties: IdProperties,
  indexId: string,
  renderer: SubentryRenderer,
): Content => {
  const heading = renderHeading(subentry.key, renderer);
  const locatorList = renderLocatorList(subentry.locators, renderer);
  const xrefPreferredList = renderPreferredXrefList(subentry.xrefPreferred, indexId, renderer);
  const xrefRelatedList = renderRelatedXrefList(subentry.xrefRelated, indexId, renderer);
  return (
    renderer.self?.({ heading, locatorList, xrefPreferredList, xrefRelatedList }) ?? [
      h("li", properties, [...heading, ...locatorList, ...xrefPreferredList, ...xrefRelatedList]),
    ]
  );
};

type EntryContentRenderer = EntryRenderer | SubentryRenderer;

const renderLocatorList = (
  locators: readonly Locator[],
  renderer: EntryContentRenderer,
): Content => {
  const properties = { dataIndexRole: "locator-list" } as const;
  const listRenderer = renderer.locatorList?.({ properties }) ?? {};
  const rendered = locators.map((locator) => ({
    locator,
    content: renderLocator(locator, listRenderer),
  }));
  return (
    listRenderer.self?.({ locators: rendered }) ?? [
      h(
        "ol",
        properties,
        rendered.flatMap(({ content }) => content),
      ),
    ]
  );
};

const defaultPageNumber = (target: string): hast.Element =>
  h("span", { dataIndexRole: "page-number", dataIndexPageTarget: target });

const defaultLocatorAnchor = ({ location }: Locator): Content =>
  location.type === "page"
    ? [h("a", { dataIndexRole: "page", href: location.href }, [defaultPageNumber(location.href)])]
    : [
        h("a", { dataIndexRole: "range", href: location.start }, [
          defaultPageNumber(location.start),
          h("span", { dataIndexRole: "range-separator" }),
          defaultPageNumber(location.end),
        ]),
      ];

const renderLocator = (locator: Locator, renderer: LocatorListRenderer): Content => {
  const properties = {};
  const content = renderer.locator?.({ locator }) ?? defaultLocatorAnchor(locator);
  const children = fillSlot(locator.template, content);
  return children.length === 0 ? [] : [h("li", properties, children)];
};

const xrefId = (indexId: string, { group, entry, subentry }: EntryAddress): string =>
  subentry === undefined
    ? headingId(indexId, [group, entry])
    : headingId(indexId, [group, entry, subentry]);

const renderPreferredXrefList = (
  xrefs: readonly Xref[],
  indexId: string,
  renderer: EntryContentRenderer,
): Content => {
  const type = "preferred";
  const properties = { dataIndexRole: "xref-preferred" } as const;
  const listRenderer = renderer.xrefPreferredList?.({ type, properties }) ?? {};
  return renderXrefs(xrefs, type, indexId, properties, listRenderer);
};

const renderRelatedXrefList = (
  xrefs: readonly Xref[],
  indexId: string,
  renderer: EntryContentRenderer,
): Content => {
  const type = "related";
  const properties = { dataIndexRole: "xref-related" } as const;
  const listRenderer = renderer.xrefRelatedList?.({ type, properties }) ?? {};
  return renderXrefs(xrefs, type, indexId, properties, listRenderer);
};

const renderXrefs = (
  xrefs: readonly Xref[],
  type: XrefType,
  indexId: string,
  properties: RoleProperties<"xref-preferred"> | RoleProperties<"xref-related">,
  renderer: XrefListRenderer,
): Content => {
  const rendered = xrefs.map((xref) => ({
    xref,
    content: renderXref(xref, type, indexId, renderer),
  }));
  return (
    renderer.self?.({ xrefs: rendered }) ?? [
      h(
        "ul",
        properties,
        rendered.flatMap(({ content }) => content),
      ),
    ]
  );
};

const renderXref = (
  xref: Xref,
  type: XrefType,
  indexId: string,
  renderer: XrefListRenderer,
): Content => {
  const properties = {};
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
  const content = renderer.xref?.({ xref, type, href, contents }) ?? [h("a", { href }, contents)];
  const children = fillSlot(template, content);
  return children.length === 0 ? [] : [h("li", properties, children)];
};
