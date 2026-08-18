import { parseFragment } from "./html.ts";
import { createEntryId, createSubentryId } from "./id.ts";
import type {
  EntryAddress,
  IndexError,
  Key,
  Locator,
  LocatorError,
  ReadonlyEntry,
  ReadonlyGroup,
  ReadonlyIndex,
  ReadonlySubentry,
  Xref,
  XrefError,
  XrefType,
} from "./model.ts";
import { fillSlot } from "./template.ts";

import type * as hast from "hast";
import { h } from "hastscript";

type RoleProperties<Role extends string> = Readonly<hast.Properties & { dataIndexRole: Role }>;
type IdProperties = Readonly<hast.Properties & { id: string }>;
type ErrorProperties<Error extends IndexError> = Readonly<{ dataIndexError?: Error }>;

function errorProperties<Error extends IndexError>(
  error: Error | undefined,
): ErrorProperties<Error> {
  return error === undefined ? {} : { dataIndexError: error };
}

export type HeadingRenderer = (parts: {
  properties: Readonly<hast.Properties>;
  contents: hast.ElementContent[];
}) => hast.ElementContent[];

const defaultHeading: HeadingRenderer = ({ properties, contents }) => [
  h("span", properties, contents),
];

export type LocationRenderer = Readonly<{
  compose?(parts: {
    properties: Readonly<
      hast.Properties & {
        dataIndexRole: "page" | "range";
        href: string;
      } & ErrorProperties<LocatorError>
    >;
    contents: hast.ElementContent[];
  }): hast.ElementContent[];
  pageNumber?(context: {
    properties: RoleProperties<"page-number"> & Readonly<{ dataIndexPageTarget: string }>;
  }): hast.ElementContent[];
  rangeSeparator?(context: {
    properties: RoleProperties<"range-separator">;
  }): hast.ElementContent[];
}>;

const defaultLocationCompose: NonNullable<LocationRenderer["compose"]> = ({
  properties,
  contents,
}) => [h("a", properties, contents)];

const defaultPageNumber: NonNullable<LocationRenderer["pageNumber"]> = ({ properties }) => [
  h("span", properties),
];

const defaultRangeSeparator: NonNullable<LocationRenderer["rangeSeparator"]> = ({ properties }) => [
  h("span", properties),
];

export type LocatorRenderer = Readonly<{
  compose?(parts: {
    properties: Readonly<hast.Properties>;
    contents: hast.ElementContent[];
  }): hast.ElementContent[];
  location?: LocationRenderer;
}>;

const defaultLocatorCompose: NonNullable<LocatorRenderer["compose"]> = ({
  properties,
  contents,
}) => [h("li", properties, contents)];

export type XrefTargetRenderer<Type extends XrefType> = Readonly<{
  compose?(parts: {
    properties: Readonly<hast.Properties & { href: string } & ErrorProperties<XrefError>>;
    contents: hast.ElementContent[];
  }): hast.ElementContent[];
  entry?(parts: {
    properties: RoleProperties<`xref-${Type}-entry`>;
    contents: hast.ElementContent[];
  }): hast.ElementContent[];
  subentrySeparator?(parts: {
    properties: RoleProperties<`xref-${Type}-subentry-separator`>;
  }): hast.ElementContent[];
  subentry?(parts: {
    properties: RoleProperties<`xref-${Type}-subentry`>;
    contents: hast.ElementContent[];
  }): hast.ElementContent[];
}>;

export type XrefPreferredTargetRenderer = XrefTargetRenderer<"preferred">;
export type XrefRelatedTargetRenderer = XrefTargetRenderer<"related">;

const defaultXrefTargetCompose: NonNullable<XrefTargetRenderer<XrefType>["compose"]> = ({
  properties,
  contents,
}) => [h("a", properties, contents)];

const defaultXrefEntry: NonNullable<XrefTargetRenderer<XrefType>["entry"]> = ({
  properties,
  contents,
}) => [h("span", properties, contents)];

const defaultXrefSubentrySeparator: NonNullable<
  XrefTargetRenderer<XrefType>["subentrySeparator"]
> = ({ properties }) => [h("span", properties)];

const defaultXrefSubentry: NonNullable<XrefTargetRenderer<XrefType>["subentry"]> = ({
  properties,
  contents,
}) => [h("span", properties, contents)];

export type XrefRenderer<Type extends XrefType> = Readonly<{
  compose?(parts: {
    properties: Readonly<hast.Properties>;
    contents: hast.ElementContent[];
  }): hast.ElementContent[];
  target?: XrefTargetRenderer<Type>;
}>;

export type XrefPreferredRenderer = XrefRenderer<"preferred">;
export type XrefRelatedRenderer = XrefRenderer<"related">;

const defaultXrefCompose: NonNullable<XrefRenderer<XrefType>["compose"]> = ({
  properties,
  contents,
}) => [h("li", properties, contents)];

export type LocatorListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"locator-list">;
    locators: readonly hast.ElementContent[][];
  }): hast.ElementContent[];
  locator?(context: { locator: Locator }): LocatorRenderer;
}>;

const defaultLocatorListCompose: NonNullable<LocatorListRenderer["compose"]> = ({
  properties,
  locators,
}) => [h("ol", properties, locators.flat())];

export type XrefPreferredListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"xref-preferred">;
    xrefPreferreds: readonly hast.ElementContent[][];
  }): hast.ElementContent[];
  xrefPreferred?(context: { xrefPreferred: Xref }): XrefPreferredRenderer;
}>;

const defaultXrefPreferredListCompose: NonNullable<XrefPreferredListRenderer["compose"]> = ({
  properties,
  xrefPreferreds,
}) => [h("ul", properties, xrefPreferreds.flat())];

export type XrefRelatedListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"xref-related">;
    xrefRelateds: readonly hast.ElementContent[][];
  }): hast.ElementContent[];
  xrefRelated?(context: { xrefRelated: Xref }): XrefRelatedRenderer;
}>;

const defaultXrefRelatedListCompose: NonNullable<XrefRelatedListRenderer["compose"]> = ({
  properties,
  xrefRelateds,
}) => [h("ul", properties, xrefRelateds.flat())];

export type SubentryRenderer = Readonly<{
  compose?(parts: {
    properties: IdProperties;
    heading: hast.ElementContent[];
    locatorList: hast.ElementContent[];
    xrefPreferredList: hast.ElementContent[];
    xrefRelatedList: hast.ElementContent[];
  }): hast.ElementContent[];
  heading?: HeadingRenderer;
  locatorList?: LocatorListRenderer;
  xrefPreferredList?: XrefPreferredListRenderer;
  xrefRelatedList?: XrefRelatedListRenderer;
}>;

const defaultSubentryCompose: NonNullable<SubentryRenderer["compose"]> = ({
  properties,
  heading,
  locatorList,
  xrefPreferredList,
  xrefRelatedList,
}) => [h("li", properties, [...heading, ...locatorList, ...xrefPreferredList, ...xrefRelatedList])];

export type SubentryListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"subentry-list">;
    subentries: readonly hast.ElementContent[][];
  }): hast.ElementContent[];
  subentry?(context: { subentry: Key }): SubentryRenderer;
}>;

const defaultSubentryListCompose: NonNullable<SubentryListRenderer["compose"]> = ({
  properties,
  subentries,
}) => [h("ul", properties, subentries.flat())];

export type EntryRenderer = Readonly<{
  compose?(parts: {
    properties: IdProperties;
    heading: hast.ElementContent[];
    locatorList: hast.ElementContent[];
    xrefPreferredList: hast.ElementContent[];
    xrefRelatedList: hast.ElementContent[];
    subentryList: hast.ElementContent[];
  }): hast.ElementContent[];
  heading?: HeadingRenderer;
  locatorList?: LocatorListRenderer;
  xrefPreferredList?: XrefPreferredListRenderer;
  xrefRelatedList?: XrefRelatedListRenderer;
  subentryList?: SubentryListRenderer;
}>;

const defaultEntryCompose: NonNullable<EntryRenderer["compose"]> = ({
  properties,
  heading,
  locatorList,
  xrefPreferredList,
  xrefRelatedList,
  subentryList,
}) => [
  h("li", properties, [
    ...heading,
    ...locatorList,
    ...xrefPreferredList,
    ...xrefRelatedList,
    ...subentryList,
  ]),
];

export type EntryListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"entry-list">;
    entries: readonly hast.ElementContent[][];
  }): hast.ElementContent[];
  entry?(context: { entry: Key }): EntryRenderer;
}>;

const defaultEntryListCompose: NonNullable<EntryListRenderer["compose"]> = ({
  properties,
  entries,
}) => [h("ul", properties, entries.flat())];

export type GroupRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"group">;
    heading: hast.ElementContent[];
    entryList: hast.ElementContent[];
  }): hast.ElementContent[];
  heading?: HeadingRenderer;
  entryList?: EntryListRenderer;
}>;

const defaultGroupCompose: NonNullable<GroupRenderer["compose"]> = ({
  properties,
  heading,
  entryList,
}) => [h("section", properties, [...heading, ...entryList])];

export type GroupListRenderer = Readonly<{
  compose?(parts: {
    properties: RoleProperties<"group-list">;
    groups: readonly hast.ElementContent[][];
  }): hast.ElementContent[];
  group?(context: { group: Key }): GroupRenderer;
}>;

const defaultGroupListCompose: NonNullable<GroupListRenderer["compose"]> = ({
  properties,
  groups,
}) => [h("div", properties, groups.flat())];

export type IndexRenderer = Readonly<{
  compose?(parts: { groupList: hast.ElementContent[] }): hast.ElementContent[];
  groupList?: GroupListRenderer;
}>;

const defaultIndexCompose: NonNullable<IndexRenderer["compose"]> = ({ groupList }) => groupList;

export type CreateRenderer = (context: { h: typeof h; index: ReadonlyIndex }) => IndexRenderer;

export function renderIndex(
  index: ReadonlyIndex,
  target: hast.Element,
  indexId: string,
  renderer: IndexRenderer,
): void {
  const groupListProperties = { dataIndexRole: "group-list" } as const;
  const groupListRenderer = renderer.groupList ?? {};
  const groups = index.children.map((group) =>
    renderGroup(
      group,
      { dataIndexRole: "group" },
      indexId,
      groupListRenderer.group?.({ group: group.key }) ?? {},
    ),
  );
  const groupListParts = { properties: groupListProperties, groups };
  const groupList =
    groupListRenderer.compose?.(groupListParts) ?? defaultGroupListCompose(groupListParts);
  target.data = { ...target.data, indexResult: index };
  const indexParts = { groupList };
  target.children = renderer.compose?.(indexParts) ?? defaultIndexCompose(indexParts);
}

type HeadingOwner = Readonly<{ heading?: HeadingRenderer }>;

const renderHeading = (key: Key, renderer: HeadingOwner): hast.ElementContent[] => {
  const properties = {};
  const contents = parseFragment(key.html);
  const headingParts = { properties, contents };
  return renderer.heading?.(headingParts) ?? defaultHeading(headingParts);
};

const renderGroup = (
  group: ReadonlyGroup,
  properties: RoleProperties<"group">,
  indexId: string,
  renderer: GroupRenderer,
): hast.ElementContent[] => {
  const heading = renderHeading(group.key, renderer);
  const entryListProperties = { dataIndexRole: "entry-list" } as const;
  const entryListRenderer = renderer.entryList ?? {};
  const entries = group.children.map((entry) =>
    renderEntry(
      entry,
      { id: createEntryId(indexId, group.key, entry.key) },
      indexId,
      group.key,
      entryListRenderer.entry?.({ entry: entry.key }) ?? {},
    ),
  );
  const entryListParts = { properties: entryListProperties, entries };
  const entryList =
    entryListRenderer.compose?.(entryListParts) ?? defaultEntryListCompose(entryListParts);
  const groupParts = { properties, heading, entryList };
  return renderer.compose?.(groupParts) ?? defaultGroupCompose(groupParts);
};

const renderEntry = (
  entry: ReadonlyEntry,
  properties: IdProperties,
  indexId: string,
  groupKey: Key,
  renderer: EntryRenderer,
): hast.ElementContent[] => {
  const heading = renderHeading(entry.key, renderer);
  const locatorList = renderLocatorList(entry.locators, renderer);
  const xrefPreferredList = renderPreferredXrefList(entry.xrefPreferred, indexId, renderer);
  const xrefRelatedList = renderRelatedXrefList(entry.xrefRelated, indexId, renderer);
  const subentryListProperties = { dataIndexRole: "subentry-list" } as const;
  const subentryListRenderer = renderer.subentryList ?? {};
  const subentries = entry.children.map((subentry) =>
    renderSubentry(
      subentry,
      { id: createSubentryId(indexId, groupKey, entry.key, subentry.key) },
      indexId,
      subentryListRenderer.subentry?.({ subentry: subentry.key }) ?? {},
    ),
  );
  const subentryListParts = {
    properties: subentryListProperties,
    subentries,
  };
  const subentryList =
    subentryListRenderer.compose?.(subentryListParts) ??
    defaultSubentryListCompose(subentryListParts);
  const entryParts = {
    properties,
    heading,
    locatorList,
    xrefPreferredList,
    xrefRelatedList,
    subentryList,
  };
  return renderer.compose?.(entryParts) ?? defaultEntryCompose(entryParts);
};

const renderSubentry = (
  subentry: ReadonlySubentry,
  properties: IdProperties,
  indexId: string,
  renderer: SubentryRenderer,
): hast.ElementContent[] => {
  const heading = renderHeading(subentry.key, renderer);
  const locatorList = renderLocatorList(subentry.locators, renderer);
  const xrefPreferredList = renderPreferredXrefList(subentry.xrefPreferred, indexId, renderer);
  const xrefRelatedList = renderRelatedXrefList(subentry.xrefRelated, indexId, renderer);
  const subentryParts = {
    properties,
    heading,
    locatorList,
    xrefPreferredList,
    xrefRelatedList,
  };
  return renderer.compose?.(subentryParts) ?? defaultSubentryCompose(subentryParts);
};

type EntryContentRenderer = EntryRenderer | SubentryRenderer;

const renderLocatorList = (
  locators: readonly Locator[],
  renderer: EntryContentRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "locator-list" } as const;
  const listRenderer = renderer.locatorList ?? {};
  const renderedLocators = locators.map((locator) => renderLocator(locator, listRenderer));
  const locatorListParts = { properties, locators: renderedLocators };
  return listRenderer.compose?.(locatorListParts) ?? defaultLocatorListCompose(locatorListParts);
};

const renderPageNumber = (target: string, renderer: LocationRenderer): hast.ElementContent[] => {
  const properties = { dataIndexRole: "page-number", dataIndexPageTarget: target } as const;
  const pageNumberParts = { properties };
  return renderer.pageNumber?.(pageNumberParts) ?? defaultPageNumber(pageNumberParts);
};

const renderLocatorContents = (
  { location }: Locator,
  renderer: LocationRenderer,
): hast.ElementContent[] => {
  if (location.type === "page") {
    return renderPageNumber(location.href, renderer);
  }
  const separatorProperties = { dataIndexRole: "range-separator" } as const;
  const rangeSeparatorParts = { properties: separatorProperties };
  return [
    ...renderPageNumber(location.start, renderer),
    ...(renderer.rangeSeparator?.(rangeSeparatorParts) ??
      defaultRangeSeparator(rangeSeparatorParts)),
    ...renderPageNumber(location.end, renderer),
  ];
};

const renderLocator = (
  locator: Locator,
  listRenderer: LocatorListRenderer,
): hast.ElementContent[] => {
  const { location } = locator;
  const locationProperties = {
    dataIndexRole: location.type,
    href: location.type === "page" ? location.href : location.start,
    ...errorProperties(locator.error),
  } as const;
  const renderer = listRenderer.locator?.({ locator }) ?? {};
  const locationRenderer = renderer.location ?? {};
  const locationParts = {
    properties: locationProperties,
    contents: renderLocatorContents(locator, locationRenderer),
  };
  const content =
    locationRenderer.compose?.(locationParts) ?? defaultLocationCompose(locationParts);
  const contents = fillSlot(locator.template, content);
  if (contents.length === 0) {
    return [];
  }
  const locatorParts = { properties: {}, contents };
  return renderer.compose?.(locatorParts) ?? defaultLocatorCompose(locatorParts);
};

const xrefId = (indexId: string, { group, entry, subentry }: EntryAddress): string =>
  subentry === undefined
    ? createEntryId(indexId, group, entry)
    : createSubentryId(indexId, group, entry, subentry);

const renderPreferredXrefList = (
  xrefPreferreds: readonly Xref[],
  indexId: string,
  renderer: EntryContentRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "xref-preferred" } as const;
  const listRenderer = renderer.xrefPreferredList ?? {};
  const renderedXrefPreferreds = xrefPreferreds.map((xrefPreferred) =>
    renderXref(
      "preferred",
      xrefPreferred,
      indexId,
      listRenderer.xrefPreferred?.({ xrefPreferred }) ?? {},
    ),
  );
  const xrefPreferredListParts = {
    properties,
    xrefPreferreds: renderedXrefPreferreds,
  };
  return (
    listRenderer.compose?.(xrefPreferredListParts) ??
    defaultXrefPreferredListCompose(xrefPreferredListParts)
  );
};

const renderRelatedXrefList = (
  xrefRelateds: readonly Xref[],
  indexId: string,
  renderer: EntryContentRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "xref-related" } as const;
  const listRenderer = renderer.xrefRelatedList ?? {};
  const renderedXrefRelateds = xrefRelateds.map((xrefRelated) =>
    renderXref("related", xrefRelated, indexId, listRenderer.xrefRelated?.({ xrefRelated }) ?? {}),
  );
  const xrefRelatedListParts = {
    properties,
    xrefRelateds: renderedXrefRelateds,
  };
  return (
    listRenderer.compose?.(xrefRelatedListParts) ??
    defaultXrefRelatedListCompose(xrefRelatedListParts)
  );
};

const xrefProperties = (
  { target, error }: Xref,
  indexId: string,
): Readonly<hast.Properties & { href: string } & ErrorProperties<XrefError>> => ({
  href: `#${xrefId(indexId, target)}`,
  ...errorProperties(error),
});

const renderXrefContents = <Type extends XrefType>(
  type: Type,
  { target }: Xref,
  renderer: XrefTargetRenderer<Type>,
): hast.ElementContent[] => {
  const entryProperties = { dataIndexRole: `xref-${type}-entry` } as const;
  const entryContents = parseFragment(target.entry.html);
  const entryParts = { properties: entryProperties, contents: entryContents };
  const entry = renderer.entry?.(entryParts) ?? defaultXrefEntry(entryParts);
  if (target.subentry === undefined) {
    return entry;
  }
  const separatorProperties = {
    dataIndexRole: `xref-${type}-subentry-separator`,
  } as const;
  const subentryProperties = { dataIndexRole: `xref-${type}-subentry` } as const;
  const subentryContents = parseFragment(target.subentry.html);
  const subentrySeparatorParts = { properties: separatorProperties };
  const subentryParts = { properties: subentryProperties, contents: subentryContents };
  return [
    ...entry,
    ...(renderer.subentrySeparator?.(subentrySeparatorParts) ??
      defaultXrefSubentrySeparator(subentrySeparatorParts)),
    ...(renderer.subentry?.(subentryParts) ?? defaultXrefSubentry(subentryParts)),
  ];
};

const renderXref = <Type extends XrefType>(
  type: Type,
  xref: Xref,
  indexId: string,
  renderer: XrefRenderer<Type>,
): hast.ElementContent[] => {
  const targetRenderer = renderer.target ?? {};
  const targetParts = {
    properties: xrefProperties(xref, indexId),
    contents: renderXrefContents(type, xref, targetRenderer),
  };
  const content = targetRenderer.compose?.(targetParts) ?? defaultXrefTargetCompose(targetParts);
  const contents = fillSlot(xref.template, content);
  if (contents.length === 0) {
    return [];
  }
  const xrefParts = { properties: {}, contents };
  return renderer.compose?.(xrefParts) ?? defaultXrefCompose(xrefParts);
};
