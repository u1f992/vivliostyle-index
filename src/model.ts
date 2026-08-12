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

type ReferenceTarget = EntryAddress;

const sequentialIdBrand = Symbol();
type SequentialId = string & { [sequentialIdBrand]: unknown };
let counter = 0n;
function getId(): SequentialId {
  counter++;
  return counter.toString().padStart(16, "0") as SequentialId;
}

type LocatorEntry = Readonly<{
  sequence: SequentialId;
  locator: Locator;
  important: boolean;
}>;
type LocatorInput = Omit<LocatorEntry, "sequence">;
type HasLocators = { locators: LocatorEntry[] };
export function insertLocator(entry: HasLocators, input: LocatorInput) {
  entry.locators.push({ sequence: getId(), ...input });
}

type ReferenceEntry = Readonly<{
  sequence: SequentialId;
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
) {
  entry[type].push({ sequence: getId(), target });
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
