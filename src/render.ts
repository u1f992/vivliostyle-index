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

export type HeadingRenderer = (contents: ElemContent[]) => ElemContent[];

export type EntryRendererBase = Readonly<{
  heading?: HeadingRenderer;
  locatorAnchors?: (context: { locator: Locator }) => ElemContent[];
  locator?(context: {
    locator: Locator;
    anchors: ElemContent[];
    children: ElemContent[];
  }): ElemContent[];
  locatorList?(parts: { locators: { locator: Locator; children: ElemContent[] }[] }): ElemContent[];
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
  xrefPreferredList?(parts: { xrefs: { xref: Xref; children: ElemContent[] }[] }): ElemContent[];
  xrefRelatedList?(parts: { xrefs: { xref: Xref; children: ElemContent[] }[] }): ElemContent[];
}>;

export type SubentryRenderer = EntryRendererBase &
  Readonly<{
    self?(parts: {
      props: hast.Properties & { id: string };
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
      subentries: { subentry: ReadonlySubentry; children: ElemContent[] }[];
    }): ElemContent[];
    self?(parts: {
      props: hast.Properties & { id: string };
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
    entries: { entry: ReadonlyEntry; children: ElemContent[] }[];
  }): ElemContent[];
  self?(parts: { heading: ElemContent[]; entryList: ElemContent[] }): ElemContent[];
}>;

export type IndexRenderer = Readonly<{
  preamble?: () => ElemContent[];
  group?: (context: { group: ReadonlyGroup }) => GroupRenderer;
  groupList?(parts: { groups: { group: ReadonlyGroup; children: ElemContent[] }[] }): ElemContent[];
  self?(parts: {
    props: hast.Properties & { dataIndexResult: string };
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
): ElemContent[] => {
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
): ElemContent[] => {
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

const defaultLocatorAnchors = ({ location }: Locator): ElemContent[] =>
  location.type === "page"
    ? [h("a", { href: location.href })]
    : [h("a", { href: location.start }), h("span"), h("a", { href: location.end })];

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
