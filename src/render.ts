import { parseFragment } from "./html.ts";
import { createEntryId, createSubentryId } from "./id.ts";
import type {
  EntryAddress,
  IndexError,
  Key,
  Locator,
  LocatorError,
  Entry,
  Group,
  Index,
  Subentry,
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

const defaultGroupHeading: HeadingRenderer = ({ properties, contents }) => [
  h("h2", properties, contents),
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
}) => [h("ul", properties, locators.flat())];

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

export type CreateRenderer = (context: { h: typeof h; index: Index }) => IndexRenderer;

type ResolvedLocationRenderer = Readonly<Required<LocationRenderer>>;

type ResolvedLocatorRenderer = Readonly<{
  compose: NonNullable<LocatorRenderer["compose"]>;
  location: ResolvedLocationRenderer;
}>;

type ResolvedXrefTargetRenderer<Type extends XrefType> = Readonly<
  Required<XrefTargetRenderer<Type>>
>;

type ResolvedXrefRenderer<Type extends XrefType> = Readonly<{
  compose: NonNullable<XrefRenderer<Type>["compose"]>;
  target: ResolvedXrefTargetRenderer<Type>;
}>;

type ResolvedLocatorListRenderer = Readonly<{
  compose: NonNullable<LocatorListRenderer["compose"]>;
  locator(context: { locator: Locator }): ResolvedLocatorRenderer;
}>;

type ResolvedXrefPreferredListRenderer = Readonly<{
  compose: NonNullable<XrefPreferredListRenderer["compose"]>;
  xrefPreferred(context: { xrefPreferred: Xref }): ResolvedXrefRenderer<"preferred">;
}>;

type ResolvedXrefRelatedListRenderer = Readonly<{
  compose: NonNullable<XrefRelatedListRenderer["compose"]>;
  xrefRelated(context: { xrefRelated: Xref }): ResolvedXrefRenderer<"related">;
}>;

type ResolvedSubentryRenderer = Readonly<{
  compose: NonNullable<SubentryRenderer["compose"]>;
  heading: HeadingRenderer;
  locatorList: ResolvedLocatorListRenderer;
  xrefPreferredList: ResolvedXrefPreferredListRenderer;
  xrefRelatedList: ResolvedXrefRelatedListRenderer;
}>;

type ResolvedSubentryListRenderer = Readonly<{
  compose: NonNullable<SubentryListRenderer["compose"]>;
  subentry(context: { subentry: Key }): ResolvedSubentryRenderer;
}>;

type ResolvedEntryRenderer = Readonly<{
  compose: NonNullable<EntryRenderer["compose"]>;
  heading: HeadingRenderer;
  locatorList: ResolvedLocatorListRenderer;
  xrefPreferredList: ResolvedXrefPreferredListRenderer;
  xrefRelatedList: ResolvedXrefRelatedListRenderer;
  subentryList: ResolvedSubentryListRenderer;
}>;

type ResolvedEntryListRenderer = Readonly<{
  compose: NonNullable<EntryListRenderer["compose"]>;
  entry(context: { entry: Key }): ResolvedEntryRenderer;
}>;

type ResolvedGroupRenderer = Readonly<{
  compose: NonNullable<GroupRenderer["compose"]>;
  heading: HeadingRenderer;
  entryList: ResolvedEntryListRenderer;
}>;

type ResolvedGroupListRenderer = Readonly<{
  compose: NonNullable<GroupListRenderer["compose"]>;
  group(context: { group: Key }): ResolvedGroupRenderer;
}>;

type ResolvedIndexRenderer = Readonly<{
  compose: NonNullable<IndexRenderer["compose"]>;
  groupList: ResolvedGroupListRenderer;
}>;

const bindRendererMethod = <Arguments extends unknown[], Result>(
  renderer: object,
  method: ((...arguments_: Arguments) => Result) | undefined,
  defaultMethod: (...arguments_: Arguments) => Result,
): ((...arguments_: Arguments) => Result) =>
  method === undefined ? defaultMethod : method.bind(renderer);

const resolveLocationRenderer = (renderer: LocationRenderer): ResolvedLocationRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultLocationCompose),
  pageNumber: bindRendererMethod(renderer, renderer.pageNumber, defaultPageNumber),
  rangeSeparator: bindRendererMethod(renderer, renderer.rangeSeparator, defaultRangeSeparator),
});

const resolveLocatorRenderer = (renderer: LocatorRenderer): ResolvedLocatorRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultLocatorCompose),
  location: resolveLocationRenderer(renderer.location ?? {}),
});

const resolveXrefTargetRenderer = <Type extends XrefType>(
  renderer: XrefTargetRenderer<Type>,
): ResolvedXrefTargetRenderer<Type> => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultXrefTargetCompose),
  entry: bindRendererMethod(renderer, renderer.entry, defaultXrefEntry),
  subentrySeparator: bindRendererMethod(
    renderer,
    renderer.subentrySeparator,
    defaultXrefSubentrySeparator,
  ),
  subentry: bindRendererMethod(renderer, renderer.subentry, defaultXrefSubentry),
});

const resolveXrefRenderer = <Type extends XrefType>(
  renderer: XrefRenderer<Type>,
): ResolvedXrefRenderer<Type> => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultXrefCompose),
  target: resolveXrefTargetRenderer(renderer.target ?? {}),
});

const resolveLocatorListRenderer = (
  renderer: LocatorListRenderer,
): ResolvedLocatorListRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultLocatorListCompose),
  locator: (context) => resolveLocatorRenderer(renderer.locator?.call(renderer, context) ?? {}),
});

const resolveXrefPreferredListRenderer = (
  renderer: XrefPreferredListRenderer,
): ResolvedXrefPreferredListRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultXrefPreferredListCompose),
  xrefPreferred: (context) =>
    resolveXrefRenderer(renderer.xrefPreferred?.call(renderer, context) ?? {}),
});

const resolveXrefRelatedListRenderer = (
  renderer: XrefRelatedListRenderer,
): ResolvedXrefRelatedListRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultXrefRelatedListCompose),
  xrefRelated: (context) =>
    resolveXrefRenderer(renderer.xrefRelated?.call(renderer, context) ?? {}),
});

const resolveSubentryRenderer = (renderer: SubentryRenderer): ResolvedSubentryRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultSubentryCompose),
  heading: bindRendererMethod(renderer, renderer.heading, defaultHeading),
  locatorList: resolveLocatorListRenderer(renderer.locatorList ?? {}),
  xrefPreferredList: resolveXrefPreferredListRenderer(renderer.xrefPreferredList ?? {}),
  xrefRelatedList: resolveXrefRelatedListRenderer(renderer.xrefRelatedList ?? {}),
});

const resolveSubentryListRenderer = (
  renderer: SubentryListRenderer,
): ResolvedSubentryListRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultSubentryListCompose),
  subentry: (context) => resolveSubentryRenderer(renderer.subentry?.call(renderer, context) ?? {}),
});

const resolveEntryRenderer = (renderer: EntryRenderer): ResolvedEntryRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultEntryCompose),
  heading: bindRendererMethod(renderer, renderer.heading, defaultHeading),
  locatorList: resolveLocatorListRenderer(renderer.locatorList ?? {}),
  xrefPreferredList: resolveXrefPreferredListRenderer(renderer.xrefPreferredList ?? {}),
  xrefRelatedList: resolveXrefRelatedListRenderer(renderer.xrefRelatedList ?? {}),
  subentryList: resolveSubentryListRenderer(renderer.subentryList ?? {}),
});

const resolveEntryListRenderer = (renderer: EntryListRenderer): ResolvedEntryListRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultEntryListCompose),
  entry: (context) => resolveEntryRenderer(renderer.entry?.call(renderer, context) ?? {}),
});

const resolveGroupRenderer = (renderer: GroupRenderer): ResolvedGroupRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultGroupCompose),
  heading: bindRendererMethod(renderer, renderer.heading, defaultGroupHeading),
  entryList: resolveEntryListRenderer(renderer.entryList ?? {}),
});

const resolveGroupListRenderer = (renderer: GroupListRenderer): ResolvedGroupListRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultGroupListCompose),
  group: (context) => resolveGroupRenderer(renderer.group?.call(renderer, context) ?? {}),
});

const resolveIndexRenderer = (renderer: IndexRenderer): ResolvedIndexRenderer => ({
  compose: bindRendererMethod(renderer, renderer.compose, defaultIndexCompose),
  groupList: resolveGroupListRenderer(renderer.groupList ?? {}),
});

export const defaultRenderer: CreateRenderer = () => resolveIndexRenderer({});

export function renderIndex(
  index: Index,
  target: hast.Element,
  indexId: string,
  renderer: IndexRenderer,
): void {
  const resolvedRenderer = resolveIndexRenderer(renderer);
  const groupListProperties = { dataIndexRole: "group-list" } as const;
  const groupListRenderer = resolvedRenderer.groupList;
  const groups = index.groups.map((group) =>
    renderGroup(
      group,
      { dataIndexRole: "group" },
      indexId,
      groupListRenderer.group({ group: group.key }),
    ),
  );
  const groupListParts = { properties: groupListProperties, groups };
  const groupList = groupListRenderer.compose(groupListParts);
  target.data = { ...target.data, indexResult: index };
  const indexParts = { groupList };
  target.children = resolvedRenderer.compose(indexParts);
}

type HeadingOwner = Readonly<{ heading: HeadingRenderer }>;

const renderHeading = (key: Key, renderer: HeadingOwner): hast.ElementContent[] => {
  const properties = {};
  const contents = parseFragment(key.html);
  const headingParts = { properties, contents };
  return renderer.heading(headingParts);
};

const renderGroup = (
  group: Group,
  properties: RoleProperties<"group">,
  indexId: string,
  renderer: ResolvedGroupRenderer,
): hast.ElementContent[] => {
  const heading = renderHeading(group.key, renderer);
  const entryListProperties = { dataIndexRole: "entry-list" } as const;
  const entryListRenderer = renderer.entryList;
  const entries = group.entries.map((entry) =>
    renderEntry(
      entry,
      { id: createEntryId(indexId, group.key, entry.key) },
      indexId,
      group.key,
      entryListRenderer.entry({ entry: entry.key }),
    ),
  );
  const entryListParts = { properties: entryListProperties, entries };
  const entryList = entryListRenderer.compose(entryListParts);
  const groupParts = { properties, heading, entryList };
  return renderer.compose(groupParts);
};

const renderEntry = (
  entry: Entry,
  properties: IdProperties,
  indexId: string,
  groupKey: Key,
  renderer: ResolvedEntryRenderer,
): hast.ElementContent[] => {
  const heading = renderHeading(entry.key, renderer);
  const locatorList = renderLocatorList(entry.locators, renderer);
  const xrefPreferredList = renderPreferredXrefList(entry.xrefPreferred, indexId, renderer);
  const xrefRelatedList = renderRelatedXrefList(entry.xrefRelated, indexId, renderer);
  const subentryListProperties = { dataIndexRole: "subentry-list" } as const;
  const subentryListRenderer = renderer.subentryList;
  const subentries = entry.subentries.map((subentry) =>
    renderSubentry(
      subentry,
      { id: createSubentryId(indexId, groupKey, entry.key, subentry.key) },
      indexId,
      subentryListRenderer.subentry({ subentry: subentry.key }),
    ),
  );
  const subentryListParts = {
    properties: subentryListProperties,
    subentries,
  };
  const subentryList = subentryListRenderer.compose(subentryListParts);
  const entryParts = {
    properties,
    heading,
    locatorList,
    xrefPreferredList,
    xrefRelatedList,
    subentryList,
  };
  return renderer.compose(entryParts);
};

const renderSubentry = (
  subentry: Subentry,
  properties: IdProperties,
  indexId: string,
  renderer: ResolvedSubentryRenderer,
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
  return renderer.compose(subentryParts);
};

type ResolvedEntryContentRenderer = ResolvedEntryRenderer | ResolvedSubentryRenderer;

const renderLocatorList = (
  locators: readonly Locator[],
  renderer: ResolvedEntryContentRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "locator-list" } as const;
  const listRenderer = renderer.locatorList;
  const renderedLocators = locators.map((locator) => renderLocator(locator, listRenderer));
  const locatorListParts = { properties, locators: renderedLocators };
  return listRenderer.compose(locatorListParts);
};

const renderPageNumber = (
  target: string,
  renderer: ResolvedLocationRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "page-number", dataIndexPageTarget: target } as const;
  const pageNumberParts = { properties };
  return renderer.pageNumber(pageNumberParts);
};

const renderLocatorContents = (
  { location }: Locator,
  renderer: ResolvedLocationRenderer,
): hast.ElementContent[] => {
  if (location.type === "page") {
    return renderPageNumber(location.href, renderer);
  }
  const separatorProperties = { dataIndexRole: "range-separator" } as const;
  const rangeSeparatorParts = { properties: separatorProperties };
  return [
    ...renderPageNumber(location.start, renderer),
    ...renderer.rangeSeparator(rangeSeparatorParts),
    ...renderPageNumber(location.end, renderer),
  ];
};

const renderLocator = (
  locator: Locator,
  listRenderer: ResolvedLocatorListRenderer,
): hast.ElementContent[] => {
  const { location } = locator;
  const locationProperties = {
    dataIndexRole: location.type,
    href: location.type === "page" ? location.href : location.start,
    ...errorProperties(locator.error),
  } as const;
  const renderer = listRenderer.locator({ locator });
  const locationRenderer = renderer.location;
  const locationParts = {
    properties: locationProperties,
    contents: renderLocatorContents(locator, locationRenderer),
  };
  const content = locationRenderer.compose(locationParts);
  const contents = fillSlot(locator.template, content);
  if (contents.length === 0) {
    return [];
  }
  const locatorParts = { properties: {}, contents };
  return renderer.compose(locatorParts);
};

const xrefId = (indexId: string, { group, entry, subentry }: EntryAddress): string =>
  subentry === undefined
    ? createEntryId(indexId, group, entry)
    : createSubentryId(indexId, group, entry, subentry);

const renderPreferredXrefList = (
  xrefPreferreds: readonly Xref[],
  indexId: string,
  renderer: ResolvedEntryContentRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "xref-preferred" } as const;
  const listRenderer = renderer.xrefPreferredList;
  const renderedXrefPreferreds = xrefPreferreds.map((xrefPreferred) =>
    renderXref("preferred", xrefPreferred, indexId, listRenderer.xrefPreferred({ xrefPreferred })),
  );
  const xrefPreferredListParts = {
    properties,
    xrefPreferreds: renderedXrefPreferreds,
  };
  return listRenderer.compose(xrefPreferredListParts);
};

const renderRelatedXrefList = (
  xrefRelateds: readonly Xref[],
  indexId: string,
  renderer: ResolvedEntryContentRenderer,
): hast.ElementContent[] => {
  const properties = { dataIndexRole: "xref-related" } as const;
  const listRenderer = renderer.xrefRelatedList;
  const renderedXrefRelateds = xrefRelateds.map((xrefRelated) =>
    renderXref("related", xrefRelated, indexId, listRenderer.xrefRelated({ xrefRelated })),
  );
  const xrefRelatedListParts = {
    properties,
    xrefRelateds: renderedXrefRelateds,
  };
  return listRenderer.compose(xrefRelatedListParts);
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
  renderer: ResolvedXrefTargetRenderer<Type>,
): hast.ElementContent[] => {
  const entryProperties = { dataIndexRole: `xref-${type}-entry` } as const;
  const entryContents = parseFragment(target.entry.html);
  const entryParts = { properties: entryProperties, contents: entryContents };
  const entry = renderer.entry(entryParts);
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
    ...renderer.subentrySeparator(subentrySeparatorParts),
    ...renderer.subentry(subentryParts),
  ];
};

const renderXref = <Type extends XrefType>(
  type: Type,
  xref: Xref,
  indexId: string,
  renderer: ResolvedXrefRenderer<Type>,
): hast.ElementContent[] => {
  const targetRenderer = renderer.target;
  const targetParts = {
    properties: xrefProperties(xref, indexId),
    contents: renderXrefContents(type, xref, targetRenderer),
  };
  const content = targetRenderer.compose(targetParts);
  const contents = fillSlot(xref.template, content);
  if (contents.length === 0) {
    return [];
  }
  const xrefParts = { properties: {}, contents };
  return renderer.compose(xrefParts);
};
