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
export type Entry = HasKey & EntryBase & { subentries: Subentry[] };
export type Group = HasKey & { entries: Entry[] };

export type Index = { groups: Group[] };

export type ReadonlySubentry = Readonly<{
  key: Key;
  locators: readonly Locator[];
  xrefPreferred: readonly Xref[];
  xrefRelated: readonly Xref[];
}>;
export type ReadonlyEntry = ReadonlySubentry &
  Readonly<{ subentries: readonly ReadonlySubentry[] }>;
export type ReadonlyGroup = Readonly<{ key: Key; entries: readonly ReadonlyEntry[] }>;
export type ReadonlyIndex = Readonly<{ groups: readonly ReadonlyGroup[] }>;

const childLookups = new WeakMap<object, Map<string, HasKey>>();

const childKey = (key: Key): string => JSON.stringify([key.html, key.reading]);

function childLookup<TChild extends HasKey>(children: TChild[]): Map<string, TChild> {
  const cached = childLookups.get(children);
  if (cached !== undefined) {
    return cached as Map<string, TChild>;
  }
  const built = new Map<string, TChild>();
  for (const child of children) {
    if (!built.has(childKey(child.key))) {
      built.set(childKey(child.key), child);
    }
  }
  childLookups.set(children, built);
  return built;
}

export function getChild<TChild extends HasKey>(children: TChild[], key: Key) {
  return childLookup(children).get(childKey(key));
}

export function ensureChild<TChild extends HasKey>(
  children: TChild[],
  key: Key,
  init: Omit<TChild, "key">,
) {
  const lookup = childLookup(children);
  const existing = lookup.get(childKey(key));
  if (existing !== undefined) {
    return existing;
  }
  const created = { key, ...init } as TChild;
  children.push(created);
  lookup.set(childKey(key), created);
  return created;
}

export function ensureEntry(index: Index, address: EntryAddress): EntryBase {
  const group = ensureChild(index.groups, address.group, { entries: [] });
  const entry = ensureChild(group.entries, address.entry, {
    subentries: [],
    locators: [],
    xrefPreferred: [],
    xrefRelated: [],
  });
  return address.subentry === undefined
    ? entry
    : ensureChild(entry.subentries, address.subentry, {
        locators: [],
        xrefPreferred: [],
        xrefRelated: [],
      });
}

export function findUnresolvedXref(index: Index, target: EntryAddress): UnresolvedXref | undefined {
  const group = getChild(index.groups, target.group);
  if (!group) {
    return { target, missing: "group" };
  }
  const entry = getChild(group.entries, target.entry);
  if (!entry) {
    return { target, missing: "entry" };
  }
  if (target.subentry !== undefined && !getChild(entry.subentries, target.subentry)) {
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
  for (const group of index.groups) {
    for (const entry of group.entries) {
      entry.xrefPreferred = entry.xrefPreferred.map(label);
      entry.xrefRelated = entry.xrefRelated.map(label);
      for (const subentry of entry.subentries) {
        subentry.xrefPreferred = subentry.xrefPreferred.map(label);
        subentry.xrefRelated = subentry.xrefRelated.map(label);
      }
    }
  }
  return unresolvedByTarget;
}
