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

export type HeadingRenderer = (parts: {
  properties: ElementProperties;
  contents: Content;
}) => Content;

export type LocatorRenderer = Readonly<{
  compose?(parts: {
    properties: Readonly<hast.Properties & { dataIndexRole: "page" | "range"; href: string }>;
    contents: Content;
  }): Content;
  pageNumber?(context: {
    properties: RoleProperties<"page-number"> & Readonly<{ dataIndexPageTarget: string }>;
  }): Content;
  rangeSeparator?(context: { properties: RoleProperties<"range-separator"> }): Content;
}>;

export type XrefPreferredRenderer = (parts: {
  xref: Xref;
  type: "preferred";
  href: string;
  contents: Content;
}) => Content;

export type XrefRelatedRenderer = (parts: {
  xref: Xref;
  type: "related";
  href: string;
  contents: Content;
}) => Content;

export type LocatorListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"locator-list">;
    locators: readonly Content[];
  }): Content;
  locator?(context: { locator: Locator }): LocatorRenderer;
}>;

export type XrefPreferredListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"xref-preferred">;
    xrefs: readonly Content[];
  }): Content;
  xref?: XrefPreferredRenderer;
}>;

export type XrefRelatedListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"xref-related">;
    xrefs: readonly Content[];
  }): Content;
  xref?: XrefRelatedRenderer;
}>;

export type SubentryRenderer = Readonly<{
  compose?(parts: {
    properties: IdProperties;
    heading: Content;
    locatorList: Content;
    xrefPreferredList: Content;
    xrefRelatedList: Content;
  }): Content;
  heading?: HeadingRenderer;
  locatorList?: LocatorListRenderer;
  xrefPreferredList?: XrefPreferredListRenderer;
  xrefRelatedList?: XrefRelatedListRenderer;
}>;

export type SubentryListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"subentry-list">;
    subentries: readonly Content[];
  }): Content;
  subentry?(context: { subentry: Key }): SubentryRenderer;
}>;

export type EntryRenderer = Readonly<{
  compose?(parts: {
    properties: IdProperties;
    heading: Content;
    locatorList: Content;
    xrefPreferredList: Content;
    xrefRelatedList: Content;
    subentryList: Content;
  }): Content;
  heading?: HeadingRenderer;
  locatorList?: LocatorListRenderer;
  xrefPreferredList?: XrefPreferredListRenderer;
  xrefRelatedList?: XrefRelatedListRenderer;
  subentryList?: SubentryListRenderer;
}>;

export type EntryListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"entry-list">;
    entries: readonly Content[];
  }): Content;
  entry?(context: { entry: Key }): EntryRenderer;
}>;

export type GroupRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"group">;
    heading: Content;
    entryList: Content;
  }): Content;
  heading?: HeadingRenderer;
  entryList?: EntryListRenderer;
}>;

export type GroupListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"group-list">;
    groups: readonly Content[];
  }): Content;
  group?(context: { group: Key }): GroupRenderer;
}>;

export type IndexRenderer = Readonly<{
  groupList?: GroupListRenderer;
}>;

export type CreateRenderer = (context: { h: typeof h; index: ReadonlyIndex }) => IndexRenderer;
export type IndexCompose = (context: { h: typeof h }) => (parts: { groupList: Content }) => Content;

const defaultCompose: ReturnType<IndexCompose> = ({ groupList }) => groupList;

export function renderIndex(
  index: ReadonlyIndex,
  target: Elem,
  indexId: string,
  renderer: IndexRenderer,
  compose: ReturnType<IndexCompose> = defaultCompose,
): void {
  const groupListProperties = { dataIndexRole: "group-list" } as const;
  const groupListRenderer = renderer.groupList ?? {};
  const groups = index.children.map((group) => {
    const properties = { dataIndexRole: "group" } as const;
    const groupRenderer = groupListRenderer.group?.({ group: group.key }) ?? {};
    return renderGroup(group, properties, indexId, groupRenderer);
  });
  const groupList =
    groupListRenderer.compose?.({ properties: groupListProperties, groups }) ??
    (groups.length === 0 ? [] : [h("div", groupListProperties, groups.flat())]);
  target.properties = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  target.children = compose({ groupList });
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
  const entryListRenderer = renderer.entryList ?? {};
  const entries = group.children.map((entry) => {
    const entryProperties = { id: headingId(indexId, [group.key, entry.key]) };
    const entryRenderer = entryListRenderer.entry?.({ entry: entry.key }) ?? {};
    return renderEntry(entry, entryProperties, indexId, group.key, entryRenderer);
  });
  const entryList = entryListRenderer.compose?.({ properties: entryListProperties, entries }) ?? [
    h("ul", entryListProperties, entries.flat()),
  ];
  return (
    renderer.compose?.({ properties, heading, entryList }) ?? [
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
  const subentryListRenderer = renderer.subentryList ?? {};
  const subentries = entry.children.map((subentry) => {
    const subentryProperties = {
      id: headingId(indexId, [groupKey, entry.key, subentry.key]),
    };
    const subentryRenderer = subentryListRenderer.subentry?.({ subentry: subentry.key }) ?? {};
    return renderSubentry(subentry, subentryProperties, indexId, subentryRenderer);
  });
  const subentryList = subentryListRenderer.compose?.({
    properties: subentryListProperties,
    subentries,
  }) ?? [h("ul", subentryListProperties, subentries.flat())];
  return (
    renderer.compose?.({
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
  properties: IdProperties,
  indexId: string,
  renderer: SubentryRenderer,
): Content => {
  const heading = renderHeading(subentry.key, renderer);
  const locatorList = renderLocatorList(subentry.locators, renderer);
  const xrefPreferredList = renderPreferredXrefList(subentry.xrefPreferred, indexId, renderer);
  const xrefRelatedList = renderRelatedXrefList(subentry.xrefRelated, indexId, renderer);
  return (
    renderer.compose?.({
      properties,
      heading,
      locatorList,
      xrefPreferredList,
      xrefRelatedList,
    }) ?? [
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
  const listRenderer = renderer.locatorList ?? {};
  const renderedLocators = locators.map((locator) => renderLocator(locator, listRenderer));
  return (
    listRenderer.compose?.({ properties, locators: renderedLocators }) ?? [
      h("ol", properties, renderedLocators.flat()),
    ]
  );
};

const renderPageNumber = (target: string, renderer: LocatorRenderer): Content => {
  const properties = { dataIndexRole: "page-number", dataIndexPageTarget: target } as const;
  return renderer.pageNumber?.({ properties }) ?? [h("span", properties)];
};

const renderLocatorContents = ({ location }: Locator, renderer: LocatorRenderer): Content => {
  if (location.type === "page") {
    return renderPageNumber(location.href, renderer);
  }
  const separatorProperties = { dataIndexRole: "range-separator" } as const;
  return [
    ...renderPageNumber(location.start, renderer),
    ...(renderer.rangeSeparator?.({ properties: separatorProperties }) ?? [
      h("span", separatorProperties),
    ]),
    ...renderPageNumber(location.end, renderer),
  ];
};

const renderLocator = (locator: Locator, listRenderer: LocatorListRenderer): Content => {
  const { location } = locator;
  const properties = {
    dataIndexRole: location.type,
    href: location.type === "page" ? location.href : location.start,
  } as const;
  const renderer = listRenderer.locator?.({ locator }) ?? {};
  const contents = renderLocatorContents(locator, renderer);
  const content = renderer.compose?.({ properties, contents }) ?? [h("a", properties, contents)];
  const children = fillSlot(locator.template, content);
  return children.length === 0 ? [] : [h("li", children)];
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
  const properties = { dataIndexRole: "xref-preferred" } as const;
  const listRenderer = renderer.xrefPreferredList ?? {};
  const renderedXrefs = xrefs.map((xref) => renderPreferredXref(xref, indexId, listRenderer));
  return (
    listRenderer.compose?.({ properties, xrefs: renderedXrefs }) ?? [
      h("ul", properties, renderedXrefs.flat()),
    ]
  );
};

const renderRelatedXrefList = (
  xrefs: readonly Xref[],
  indexId: string,
  renderer: EntryContentRenderer,
): Content => {
  const properties = { dataIndexRole: "xref-related" } as const;
  const listRenderer = renderer.xrefRelatedList ?? {};
  const renderedXrefs = xrefs.map((xref) => renderRelatedXref(xref, indexId, listRenderer));
  return (
    listRenderer.compose?.({ properties, xrefs: renderedXrefs }) ?? [
      h("ul", properties, renderedXrefs.flat()),
    ]
  );
};

const xrefParts = (
  { target }: Xref,
  indexId: string,
): Readonly<{ href: string; contents: Content }> => {
  const href = `#${xrefId(indexId, target)}`;
  const contents =
    target.subentry === undefined
      ? parseFragment(target.entry.html)
      : [
          h("span", parseFragment(target.entry.html)),
          h("span"),
          h("span", parseFragment(target.subentry.html)),
        ];
  return { href, contents };
};

const applyXrefTemplate = (template: string, content: Content): Content => {
  const children = fillSlot(template, content);
  return children.length === 0 ? [] : [h("li", children)];
};

const renderPreferredXref = (
  xref: Xref,
  indexId: string,
  renderer: XrefPreferredListRenderer,
): Content => {
  const { href, contents } = xrefParts(xref, indexId);
  const content = renderer.xref?.({ xref, type: "preferred", href, contents }) ?? [
    h("a", { href }, contents),
  ];
  return applyXrefTemplate(xref.template, content);
};

const renderRelatedXref = (
  xref: Xref,
  indexId: string,
  renderer: XrefRelatedListRenderer,
): Content => {
  const { href, contents } = xrefParts(xref, indexId);
  const content = renderer.xref?.({ xref, type: "related", href, contents }) ?? [
    h("a", { href }, contents),
  ];
  return applyXrefTemplate(xref.template, content);
};
