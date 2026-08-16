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

export type TaggedElement<TagName extends string> = hast.Element & { tagName: TagName };

export type HeadingRenderer<THeading extends hast.ElementContent = hast.ElementContent> = (
  contents: hast.ElementContent[],
) => THeading[];

export type EntryRendererBase<
  THeading extends hast.ElementContent = hast.ElementContent,
  TLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TLocator extends hast.ElementContent = hast.ElementContent,
  TLocatorList extends hast.ElementContent = hast.ElementContent,
  TXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TXref extends hast.ElementContent = hast.ElementContent,
  TXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TXrefRelatedList extends hast.ElementContent = hast.ElementContent,
> = Readonly<{
  heading?: HeadingRenderer<THeading>;
  locatorAnchors?: (context: { locator: Locator }) => TLocatorAnchors[];
  locator?(context: {
    locator: Locator;
    anchors: TLocatorAnchors[];
    children: hast.ElementContent[];
  }): TLocator[];
  locatorList?(parts: { locators: { locator: Locator; children: TLocator[] }[] }): TLocatorList[];
  xrefAnchor?: (context: {
    xref: Xref;
    type: XrefType;
    href: string;
    contents: hast.ElementContent[];
  }) => TXrefAnchor[];
  xref?(context: {
    xref: Xref;
    type: XrefType;
    anchors: TXrefAnchor[];
    children: hast.ElementContent[];
  }): TXref[];
  xrefPreferredList?(parts: { xrefs: { xref: Xref; children: TXref[] }[] }): TXrefPreferredList[];
  xrefRelatedList?(parts: { xrefs: { xref: Xref; children: TXref[] }[] }): TXrefRelatedList[];
}>;

export type SubentryRenderer<
  THeading extends hast.ElementContent = hast.ElementContent,
  TLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TLocator extends hast.ElementContent = hast.ElementContent,
  TLocatorList extends hast.ElementContent = hast.ElementContent,
  TXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TXref extends hast.ElementContent = hast.ElementContent,
  TXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSelf extends hast.ElementContent = hast.ElementContent,
> = EntryRendererBase<
  THeading,
  TLocatorAnchors,
  TLocator,
  TLocatorList,
  TXrefAnchor,
  TXref,
  TXrefPreferredList,
  TXrefRelatedList
> &
  Readonly<{
    self?(parts: {
      props: hast.Properties & { id: string };
      heading: THeading[];
      locatorList: TLocatorList[];
      xrefPreferredList: TXrefPreferredList[];
      xrefRelatedList: TXrefRelatedList[];
    }): TSelf[];
  }>;

export type EntryRenderer<
  THeading extends hast.ElementContent = hast.ElementContent,
  TLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TLocator extends hast.ElementContent = hast.ElementContent,
  TLocatorList extends hast.ElementContent = hast.ElementContent,
  TXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TXref extends hast.ElementContent = hast.ElementContent,
  TXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSubentryHeading extends hast.ElementContent = hast.ElementContent,
  TSubentryLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TSubentryLocator extends hast.ElementContent = hast.ElementContent,
  TSubentryLocatorList extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TSubentryXref extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSubentrySelf extends hast.ElementContent = hast.ElementContent,
  TSubentryList extends hast.ElementContent = hast.ElementContent,
  TSelf extends hast.ElementContent = hast.ElementContent,
> = EntryRendererBase<
  THeading,
  TLocatorAnchors,
  TLocator,
  TLocatorList,
  TXrefAnchor,
  TXref,
  TXrefPreferredList,
  TXrefRelatedList
> &
  Readonly<{
    subentry?: (context: {
      subentry: ReadonlySubentry;
      id: string;
    }) => SubentryRenderer<
      TSubentryHeading,
      TSubentryLocatorAnchors,
      TSubentryLocator,
      TSubentryLocatorList,
      TSubentryXrefAnchor,
      TSubentryXref,
      TSubentryXrefPreferredList,
      TSubentryXrefRelatedList,
      TSubentrySelf
    >;
    subentryList?(parts: {
      subentries: { subentry: ReadonlySubentry; children: TSubentrySelf[] }[];
    }): TSubentryList[];
    self?(parts: {
      props: hast.Properties & { id: string };
      heading: THeading[];
      locatorList: TLocatorList[];
      xrefPreferredList: TXrefPreferredList[];
      xrefRelatedList: TXrefRelatedList[];
      subentryList: TSubentryList[];
    }): TSelf[];
  }>;

export type GroupRenderer<
  THeading extends hast.ElementContent = hast.ElementContent,
  TEntryHeading extends hast.ElementContent = hast.ElementContent,
  TEntryLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TEntryLocator extends hast.ElementContent = hast.ElementContent,
  TEntryLocatorList extends hast.ElementContent = hast.ElementContent,
  TEntryXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TEntryXref extends hast.ElementContent = hast.ElementContent,
  TEntryXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TEntryXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSubentryHeading extends hast.ElementContent = hast.ElementContent,
  TSubentryLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TSubentryLocator extends hast.ElementContent = hast.ElementContent,
  TSubentryLocatorList extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TSubentryXref extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSubentrySelf extends hast.ElementContent = hast.ElementContent,
  TSubentryList extends hast.ElementContent = hast.ElementContent,
  TEntrySelf extends hast.ElementContent = hast.ElementContent,
  TEntryList extends hast.ElementContent = hast.ElementContent,
  TSelf extends hast.ElementContent = hast.ElementContent,
> = Readonly<{
  heading?: HeadingRenderer<THeading>;
  entry?: (context: {
    entry: ReadonlyEntry;
    id: string;
  }) => EntryRenderer<
    TEntryHeading,
    TEntryLocatorAnchors,
    TEntryLocator,
    TEntryLocatorList,
    TEntryXrefAnchor,
    TEntryXref,
    TEntryXrefPreferredList,
    TEntryXrefRelatedList,
    TSubentryHeading,
    TSubentryLocatorAnchors,
    TSubentryLocator,
    TSubentryLocatorList,
    TSubentryXrefAnchor,
    TSubentryXref,
    TSubentryXrefPreferredList,
    TSubentryXrefRelatedList,
    TSubentrySelf,
    TSubentryList,
    TEntrySelf
  >;
  entryList?(parts: { entries: { entry: ReadonlyEntry; children: TEntrySelf[] }[] }): TEntryList[];
  self?(parts: { heading: THeading[]; entryList: TEntryList[] }): TSelf[];
}>;

export type IndexRenderer<
  TPreamble extends hast.ElementContent = hast.ElementContent,
  TGroupHeading extends hast.ElementContent = hast.ElementContent,
  TEntryHeading extends hast.ElementContent = hast.ElementContent,
  TEntryLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TEntryLocator extends hast.ElementContent = hast.ElementContent,
  TEntryLocatorList extends hast.ElementContent = hast.ElementContent,
  TEntryXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TEntryXref extends hast.ElementContent = hast.ElementContent,
  TEntryXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TEntryXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSubentryHeading extends hast.ElementContent = hast.ElementContent,
  TSubentryLocatorAnchors extends hast.ElementContent = hast.ElementContent,
  TSubentryLocator extends hast.ElementContent = hast.ElementContent,
  TSubentryLocatorList extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefAnchor extends hast.ElementContent = hast.ElementContent,
  TSubentryXref extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefPreferredList extends hast.ElementContent = hast.ElementContent,
  TSubentryXrefRelatedList extends hast.ElementContent = hast.ElementContent,
  TSubentrySelf extends hast.ElementContent = hast.ElementContent,
  TSubentryList extends hast.ElementContent = hast.ElementContent,
  TEntrySelf extends hast.ElementContent = hast.ElementContent,
  TEntryList extends hast.ElementContent = hast.ElementContent,
  TGroupSelf extends hast.ElementContent = hast.ElementContent,
  TGroupList extends hast.ElementContent = hast.ElementContent,
> = Readonly<{
  preamble?: () => TPreamble[];
  group?: (context: {
    group: ReadonlyGroup;
  }) => GroupRenderer<
    TGroupHeading,
    TEntryHeading,
    TEntryLocatorAnchors,
    TEntryLocator,
    TEntryLocatorList,
    TEntryXrefAnchor,
    TEntryXref,
    TEntryXrefPreferredList,
    TEntryXrefRelatedList,
    TSubentryHeading,
    TSubentryLocatorAnchors,
    TSubentryLocator,
    TSubentryLocatorList,
    TSubentryXrefAnchor,
    TSubentryXref,
    TSubentryXrefPreferredList,
    TSubentryXrefRelatedList,
    TSubentrySelf,
    TSubentryList,
    TEntrySelf,
    TEntryList,
    TGroupSelf
  >;
  groupList?(parts: { groups: { group: ReadonlyGroup; children: TGroupSelf[] }[] }): TGroupList[];
  self?(parts: {
    props: hast.Properties & { dataIndexResult: string };
    preamble: TPreamble[];
    groupList: TGroupList[];
  }): { properties: hast.Properties; children: hast.ElementContent[] };
}>;

export type CreateRenderer = (context: { h: typeof h; index: ReadonlyIndex }) => IndexRenderer;

export function indexRenderer<
  TPreamble extends hast.ElementContent = never,
  TGroupHeading extends hast.ElementContent = TaggedElement<"span">,
  TEntryHeading extends hast.ElementContent = TaggedElement<"span">,
  TEntryLocatorAnchors extends hast.ElementContent = TaggedElement<"a"> | TaggedElement<"span">,
  TEntryLocator extends hast.ElementContent = TaggedElement<"li">,
  TEntryLocatorList extends hast.ElementContent = TaggedElement<"ol">,
  TEntryXrefAnchor extends hast.ElementContent = TaggedElement<"a">,
  TEntryXref extends hast.ElementContent = TaggedElement<"li">,
  TEntryXrefPreferredList extends hast.ElementContent = TaggedElement<"ul">,
  TEntryXrefRelatedList extends hast.ElementContent = TaggedElement<"ul">,
  TSubentryHeading extends hast.ElementContent = TaggedElement<"span">,
  TSubentryLocatorAnchors extends hast.ElementContent = TaggedElement<"a"> | TaggedElement<"span">,
  TSubentryLocator extends hast.ElementContent = TaggedElement<"li">,
  TSubentryLocatorList extends hast.ElementContent = TaggedElement<"ol">,
  TSubentryXrefAnchor extends hast.ElementContent = TaggedElement<"a">,
  TSubentryXref extends hast.ElementContent = TaggedElement<"li">,
  TSubentryXrefPreferredList extends hast.ElementContent = TaggedElement<"ul">,
  TSubentryXrefRelatedList extends hast.ElementContent = TaggedElement<"ul">,
  TSubentrySelf extends hast.ElementContent = TaggedElement<"li">,
  TSubentryList extends hast.ElementContent = TaggedElement<"ul">,
  TEntrySelf extends hast.ElementContent = TaggedElement<"li">,
  TEntryList extends hast.ElementContent = TaggedElement<"ul">,
  TGroupSelf extends hast.ElementContent = TaggedElement<"section">,
  TGroupList extends hast.ElementContent = TaggedElement<"div">,
>(
  renderer: IndexRenderer<
    TPreamble,
    TGroupHeading,
    TEntryHeading,
    TEntryLocatorAnchors,
    TEntryLocator,
    TEntryLocatorList,
    TEntryXrefAnchor,
    TEntryXref,
    TEntryXrefPreferredList,
    TEntryXrefRelatedList,
    TSubentryHeading,
    TSubentryLocatorAnchors,
    TSubentryLocator,
    TSubentryLocatorList,
    TSubentryXrefAnchor,
    TSubentryXref,
    TSubentryXrefPreferredList,
    TSubentryXrefRelatedList,
    TSubentrySelf,
    TSubentryList,
    TEntrySelf,
    TEntryList,
    TGroupSelf,
    TGroupList
  >,
): IndexRenderer<
  TPreamble,
  TGroupHeading,
  TEntryHeading,
  TEntryLocatorAnchors,
  TEntryLocator,
  TEntryLocatorList,
  TEntryXrefAnchor,
  TEntryXref,
  TEntryXrefPreferredList,
  TEntryXrefRelatedList,
  TSubentryHeading,
  TSubentryLocatorAnchors,
  TSubentryLocator,
  TSubentryLocatorList,
  TSubentryXrefAnchor,
  TSubentryXref,
  TSubentryXrefPreferredList,
  TSubentryXrefRelatedList,
  TSubentrySelf,
  TSubentryList,
  TEntrySelf,
  TEntryList,
  TGroupSelf,
  TGroupList
> {
  return renderer;
}

export function renderIndex(
  index: ReadonlyIndex,
  target: hast.Element,
  indexId: string,
  renderer: IndexRenderer,
): void {
  const preamble = renderer.preamble?.() ?? [];
  const groups = index.children.map((group) => ({
    group,
    children: renderGroup(group, indexId, renderer.group?.({ group }) ?? {}),
  }));
  const groupList =
    renderer.groupList?.({ groups }) ??
    (groups.length === 0
      ? []
      : [
          h(
            "div",
            { dataIndexRole: "group-list" },
            groups.flatMap(({ children }) => children),
          ),
        ]);
  const props = { ...target.properties, dataIndexResult: JSON.stringify(index) };
  const { properties, children } = renderer.self?.({ props, preamble, groupList }) ?? {
    properties: props,
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

const renderHeading = (key: Key, heading: HeadingRenderer | undefined): hast.ElementContent[] => {
  const contents = parseFragment(key.html);
  return heading?.(contents) ?? [h("span", contents)];
};

const renderGroup = (
  group: ReadonlyGroup,
  indexId: string,
  renderer: GroupRenderer,
): hast.ElementContent[] => {
  const heading = renderHeading(group.key, renderer.heading);
  const entries = group.children.map((entry) => {
    const id = headingId(indexId, [group.key, entry.key]);
    return {
      entry,
      children: renderEntry(entry, id, indexId, group.key, renderer.entry?.({ entry, id }) ?? {}),
    };
  });
  const entryList = renderer.entryList?.({ entries }) ?? [
    h(
      "ul",
      { dataIndexRole: "entry-list" },
      entries.flatMap(({ children }) => children),
    ),
  ];
  return (
    renderer.self?.({ heading, entryList }) ?? [
      h("section", { dataIndexRole: "group" }, [...heading, ...entryList]),
    ]
  );
};

const renderEntry = (
  entry: ReadonlyEntry,
  id: string,
  indexId: string,
  groupKey: Key,
  renderer: EntryRenderer,
): hast.ElementContent[] => {
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
  const subentryList = renderer.subentryList?.({ subentries }) ?? [
    h(
      "ul",
      { dataIndexRole: "subentry-list" },
      subentries.flatMap(({ children }) => children),
    ),
  ];
  const props = { id };
  return (
    renderer.self?.({
      props,
      heading,
      locatorList,
      xrefPreferredList,
      xrefRelatedList,
      subentryList,
    }) ?? [
      h("li", props, [
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
): hast.ElementContent[] => {
  const heading = renderHeading(subentry.key, renderer.heading);
  const locatorList = renderLocatorList(subentry.locators, renderer);
  const xrefPreferredList = renderXrefList(subentry.xrefPreferred, "preferred", indexId, renderer);
  const xrefRelatedList = renderXrefList(subentry.xrefRelated, "related", indexId, renderer);
  const props = { id };
  return (
    renderer.self?.({ props, heading, locatorList, xrefPreferredList, xrefRelatedList }) ?? [
      h("li", props, [...heading, ...locatorList, ...xrefPreferredList, ...xrefRelatedList]),
    ]
  );
};

const renderLocatorList = (
  locators: readonly Locator[],
  renderer: EntryRendererBase,
): hast.ElementContent[] => {
  const rendered = locators.map((locator) => ({
    locator,
    children: renderLocatorItem(locator, renderer),
  }));
  return (
    renderer.locatorList?.({ locators: rendered }) ?? [
      h(
        "ol",
        { dataIndexRole: "locator-list" },
        rendered.flatMap(({ children }) => children),
      ),
    ]
  );
};

const defaultLocatorAnchors = ({ location }: Locator): hast.ElementContent[] =>
  location.type === "page"
    ? [h("a", { href: location.href })]
    : [h("a", { href: location.start }), h("span"), h("a", { href: location.end })];

const renderLocatorItem = (
  locator: Locator,
  renderer: EntryRendererBase,
): hast.ElementContent[] => {
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
): hast.ElementContent[] => {
  const rendered = xrefs.map((xref) => ({
    xref,
    children: renderXrefItem(xref, type, indexId, renderer),
  }));
  const renderList = type === "preferred" ? renderer.xrefPreferredList : renderer.xrefRelatedList;
  return (
    renderList?.({ xrefs: rendered }) ?? [
      h(
        "ul",
        { dataIndexRole: `xref-${type}` },
        rendered.flatMap(({ children }) => children),
      ),
    ]
  );
};

const defaultXrefAnchor = (
  href: string,
  contents: hast.ElementContent[],
): hast.ElementContent[] => [h("a", { href }, contents)];

const renderXrefItem = (
  xref: Xref,
  type: XrefType,
  indexId: string,
  renderer: EntryRendererBase,
): hast.ElementContent[] => {
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
