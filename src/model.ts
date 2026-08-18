export type Key = Readonly<{
  html: string;
  reading: string;
}>;
export type HasKey = { key: Key };

type PageLocation = Readonly<{
  type: "page";
  href: string;
}>;
type RangeLocation = Readonly<{
  type: "range";
  start: string;
  end: string;
}>;

export type EntryAddress = Readonly<{
  group: Key;
  entry: Key;
  subentry?: Key;
}>;

export type UnresolvedXref = Readonly<{
  target: EntryAddress;
  missing: keyof EntryAddress;
}>;

export type IndexError = "invalid-xref" | "unmatched-range-start" | "unmatched-range-end";
export type LocatorError = Extract<IndexError, "unmatched-range-start" | "unmatched-range-end">;
export type XrefError = Extract<IndexError, "invalid-xref">;

export type Locator = Readonly<{
  location: PageLocation | RangeLocation;
  template: string;
  error?: LocatorError;
}>;
type HasLocators = { locators: Locator[] };
export function insertLocator(entry: HasLocators, locator: Locator): void {
  entry.locators.push({ ...locator });
}

export type Xref = Readonly<{
  target: EntryAddress;
  template: string;
  error?: XrefError;
}>;
export type XrefType = "preferred" | "related";
type HasXrefs = {
  xrefPreferred: Xref[];
  xrefRelated: Xref[];
};
const xrefListKey = {
  preferred: "xrefPreferred",
  related: "xrefRelated",
} as const satisfies Record<XrefType, keyof HasXrefs>;

export function insertXref(
  entry: HasXrefs,
  type: XrefType,
  target: EntryAddress,
  template: string,
): void {
  entry[xrefListKey[type]].push({ target, template });
}

export type EntryBase = HasLocators & HasXrefs;
export type Subentry = HasKey & EntryBase;
export type ParentOf<T> = { children: T[] };
export type Entry = HasKey & EntryBase & ParentOf<Subentry>;
export type Group = HasKey & ParentOf<Entry>;

export type Index = ParentOf<Group>;

export type ReadonlySubentry = Readonly<{
  key: Key;
  locators: readonly Locator[];
  xrefPreferred: readonly Xref[];
  xrefRelated: readonly Xref[];
}>;
export type ReadonlyEntry = ReadonlySubentry & Readonly<{ children: readonly ReadonlySubentry[] }>;
export type ReadonlyGroup = Readonly<{ key: Key; children: readonly ReadonlyEntry[] }>;
export type ReadonlyIndex = Readonly<{ children: readonly ReadonlyGroup[] }>;

export function getChild<TChild extends HasKey>(parent: ParentOf<TChild>, key: Key) {
  return parent.children.find(
    (child) => child.key.html === key.html && child.key.reading === key.reading,
  );
}

export function ensureChild<TChild extends HasKey>(
  parent: ParentOf<TChild>,
  key: Key,
  init: Omit<TChild, "key">,
) {
  return (
    getChild(parent, key) ??
    parent.children[
      parent.children.push({
        key,
        ...init,
      } as TChild) - 1
    ]!
  );
}

export function ensureEntry(index: Index, address: EntryAddress): EntryBase {
  const group = ensureChild(index, address.group, { children: [] });
  const entry = ensureChild(group, address.entry, {
    children: [],
    locators: [],
    xrefPreferred: [],
    xrefRelated: [],
  });
  return address.subentry === undefined
    ? entry
    : ensureChild(entry, address.subentry, {
        locators: [],
        xrefPreferred: [],
        xrefRelated: [],
      });
}

export function findUnresolvedXref(index: Index, target: EntryAddress): UnresolvedXref | undefined {
  const group = getChild(index, target.group);
  if (!group) {
    return { target, missing: "group" };
  }
  const entry = getChild(group, target.entry);
  if (!entry) {
    return { target, missing: "entry" };
  }
  if (target.subentry !== undefined && !getChild(entry, target.subentry)) {
    return { target, missing: "subentry" };
  }
  return undefined;
}

export function labelInvalidXrefs(index: Index): void {
  const label = (xref: Xref): Xref => ({
    target: xref.target,
    template: xref.template,
    ...(findUnresolvedXref(index, xref.target) === undefined ? {} : { error: "invalid-xref" }),
  });
  for (const group of index.children) {
    for (const entry of group.children) {
      entry.xrefPreferred = entry.xrefPreferred.map(label);
      entry.xrefRelated = entry.xrefRelated.map(label);
      for (const subentry of entry.children) {
        subentry.xrefPreferred = subentry.xrefPreferred.map(label);
        subentry.xrefRelated = subentry.xrefRelated.map(label);
      }
    }
  }
}
