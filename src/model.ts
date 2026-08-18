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
  entry.locators.push(locator);
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

const childLookups = new WeakMap<object, Map<string, HasKey>>();

const childKey = (key: Key): string => JSON.stringify([key.html, key.reading]);

function childLookup<TChild extends HasKey>(parent: ParentOf<TChild>): Map<string, TChild> {
  const cached = childLookups.get(parent);
  if (cached !== undefined) {
    return cached as Map<string, TChild>;
  }
  const built = new Map<string, TChild>();
  for (const child of parent.children) {
    if (!built.has(childKey(child.key))) {
      built.set(childKey(child.key), child);
    }
  }
  childLookups.set(parent, built);
  return built;
}

export function getChild<TChild extends HasKey>(parent: ParentOf<TChild>, key: Key) {
  return childLookup(parent).get(childKey(key));
}

export function ensureChild<TChild extends HasKey>(
  parent: ParentOf<TChild>,
  key: Key,
  init: Omit<TChild, "key">,
) {
  const lookup = childLookup(parent);
  const existing = lookup.get(childKey(key));
  if (existing !== undefined) {
    return existing;
  }
  const created = { key, ...init } as TChild;
  parent.children.push(created);
  lookup.set(childKey(key), created);
  return created;
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

export function labelInvalidXrefs(index: Index): ReadonlyMap<string, UnresolvedXref> {
  const unresolvedByTarget = new Map<string, UnresolvedXref>();
  const resolvedTargets = new Set<string>();
  const resolve = (target: EntryAddress): UnresolvedXref | undefined => {
    const targetKey = JSON.stringify(target);
    if (resolvedTargets.has(targetKey)) {
      return undefined;
    }
    const known = unresolvedByTarget.get(targetKey);
    if (known !== undefined) {
      return known;
    }
    const unresolvedXref = findUnresolvedXref(index, target);
    if (unresolvedXref === undefined) {
      resolvedTargets.add(targetKey);
    } else {
      unresolvedByTarget.set(targetKey, unresolvedXref);
    }
    return unresolvedXref;
  };
  const label = (xref: Xref): Xref => ({
    target: xref.target,
    template: xref.template,
    ...(resolve(xref.target) === undefined ? {} : { error: "invalid-xref" }),
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
  return unresolvedByTarget;
}
