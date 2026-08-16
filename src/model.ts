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

export type Revocation = () => void;

function insert<T>(list: T[], item: T): Revocation {
  list.push(item);
  return () => {
    const position = list.indexOf(item);
    if (position !== -1) {
      list.splice(position, 1);
    }
  };
}

export type Locator = Readonly<{
  location: PageLocation | RangeLocation;
  template?: string;
}>;
type HasLocators = { locators: Locator[] };
export function insertLocator(entry: HasLocators, locator: Locator): Revocation {
  return insert(entry.locators, { ...locator });
}

export type Xref = Readonly<{
  target: EntryAddress;
  template?: string;
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
  template?: string,
): Revocation {
  return insert(entry[xrefListKey[type]], {
    target,
    ...(template === undefined ? {} : { template }),
  });
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

function isVacant(entry: EntryBase): boolean {
  return (
    entry.locators.length === 0 &&
    entry.xrefPreferred.length === 0 &&
    entry.xrefRelated.length === 0
  );
}

export function revokeVacantEntries(index: Index): EntryAddress[] {
  const revoked: EntryAddress[] = [];
  for (const group of index.children) {
    for (const entry of group.children) {
      entry.children = entry.children.filter((subentry) => {
        if (!isVacant(subentry)) {
          return true;
        }
        revoked.push({ group: group.key, entry: entry.key, subentry: subentry.key });
        return false;
      });
    }
    group.children = group.children.filter((entry) => {
      if (!isVacant(entry) || entry.children.length !== 0) {
        return true;
      }
      revoked.push({ group: group.key, entry: entry.key });
      return false;
    });
  }
  index.children = index.children.filter((group) => group.children.length !== 0);
  return revoked;
}
