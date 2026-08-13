export type Key = Readonly<{
  html: string;
  reading: string;
}>;
export type HasKey = { key: Key };

type PageLocator = string;
type RangeLocator = Readonly<{
  start: PageLocator;
  end: PageLocator;
}>;
type Locator = PageLocator | RangeLocator;

export type EntryAddress = Readonly<{
  group: Key;
  mainEntry: Key;
  subentry?: Key;
}>;

export type UnresolvedReference = Readonly<{
  target: EntryAddress;
  missing: keyof EntryAddress;
}>;

type ReferenceTarget = EntryAddress;

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

type LocatorEntry = Readonly<{
  locator: Locator;
  important: boolean;
}>;
type HasLocators = { locators: LocatorEntry[] };
export function insertLocator(entry: HasLocators, locatorEntry: LocatorEntry): Revocation {
  return insert(entry.locators, { ...locatorEntry });
}

type ReferenceEntry = Readonly<{
  target: ReferenceTarget;
}>;
type HasReferences = {
  see: ReferenceEntry[];
  seeAlso: ReferenceEntry[];
};
export function insertReference(
  entry: HasReferences,
  type: "see" | "seeAlso",
  target: ReferenceTarget,
): Revocation {
  return insert(entry[type], { target });
}

export type EntryBase = HasLocators & HasReferences;
export type Subentry = HasKey & EntryBase;
export type ParentOf<T> = { children: T[] };
export type MainEntry = HasKey & EntryBase & ParentOf<Subentry>;
export type Group = HasKey & ParentOf<MainEntry>;

export type Index = ParentOf<Group>;

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
  const mainEntry = ensureChild(group, address.mainEntry, {
    children: [],
    locators: [],
    see: [],
    seeAlso: [],
  });
  return address.subentry === undefined
    ? mainEntry
    : ensureChild(mainEntry, address.subentry, {
        locators: [],
        see: [],
        seeAlso: [],
      });
}

export function findUnresolvedReference(
  index: Index,
  target: ReferenceTarget,
): UnresolvedReference | undefined {
  const group = getChild(index, target.group);
  if (!group) {
    return { target, missing: "group" };
  }
  const mainEntry = getChild(group, target.mainEntry);
  if (!mainEntry) {
    return { target, missing: "mainEntry" };
  }
  if (target.subentry !== undefined && !getChild(mainEntry, target.subentry)) {
    return { target, missing: "subentry" };
  }
  return undefined;
}

function isVacant(entry: EntryBase): boolean {
  return entry.locators.length === 0 && entry.see.length === 0 && entry.seeAlso.length === 0;
}

export function revokeVacantEntries(index: Index): EntryAddress[] {
  const revoked: EntryAddress[] = [];
  for (const group of index.children) {
    for (const mainEntry of group.children) {
      mainEntry.children = mainEntry.children.filter((subentry) => {
        if (!isVacant(subentry)) {
          return true;
        }
        revoked.push({ group: group.key, mainEntry: mainEntry.key, subentry: subentry.key });
        return false;
      });
    }
    group.children = group.children.filter((mainEntry) => {
      if (!isVacant(mainEntry) || mainEntry.children.length !== 0) {
        return true;
      }
      revoked.push({ group: group.key, mainEntry: mainEntry.key });
      return false;
    });
  }
  index.children = index.children.filter((group) => group.children.length !== 0);
  return revoked;
}
