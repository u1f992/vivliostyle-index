const keyBrand = Symbol();
export type Key = Readonly<{
  reading: string;
  html: string;
  [keyBrand]: unknown;
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

export type Xref = Readonly<{
  target: EntryAddress;
  template: string;
  error?: XrefError;
}>;
export type XrefType = "preferred" | "related";

export type Subentry = Readonly<{
  key: Key;
  locators: readonly Locator[];
  xrefPreferred: readonly Xref[];
  xrefRelated: readonly Xref[];
}>;
export type Entry = Subentry & Readonly<{ subentries: readonly Subentry[] }>;
export type Group = Readonly<{ key: Key; entries: readonly Entry[] }>;
export type Index = Readonly<{ groups: readonly Group[] }>;

export type SubentryBuilder = {
  key: Key;
  locators: Locator[];
  xrefPreferred: Xref[];
  xrefRelated: Xref[];
};
export type EntryBuilder = SubentryBuilder & { subentries: Map<string, SubentryBuilder> };
export type GroupBuilder = { key: Key; entries: Map<string, EntryBuilder> };
export type IndexBuilder = { groups: Map<string, GroupBuilder> };

export function createIndexBuilder(): IndexBuilder {
  return { groups: new Map() };
}

export function createKey(reading: string, html: string): Key {
  return { reading: reading.normalize("NFC"), html: html.normalize("NFC") } as Key;
}

const keyIdentity = (key: Key): readonly [string, string] => [key.reading, key.html];

const childKey = (key: Key): string => JSON.stringify(keyIdentity(key));

export const addressKey = (address: EntryAddress): string =>
  JSON.stringify([
    keyIdentity(address.group),
    keyIdentity(address.entry),
    address.subentry === undefined ? null : keyIdentity(address.subentry),
  ]);

function ensureChild<TChild extends HasKey>(
  children: Map<string, TChild>,
  key: Key,
  create: (key: Key) => TChild,
): TChild {
  const existing = children.get(childKey(key));
  if (existing !== undefined) {
    return existing;
  }
  const created = create(key);
  children.set(childKey(key), created);
  return created;
}

const createSubentryBuilder = (key: Key): SubentryBuilder => ({
  key,
  locators: [],
  xrefPreferred: [],
  xrefRelated: [],
});
const createEntryBuilder = (key: Key): EntryBuilder => ({
  ...createSubentryBuilder(key),
  subentries: new Map(),
});
const createGroupBuilder = (key: Key): GroupBuilder => ({ key, entries: new Map() });

export function ensureEntry(
  builder: IndexBuilder,
  address: EntryAddress,
): EntryBuilder | SubentryBuilder {
  const group = ensureChild(builder.groups, address.group, createGroupBuilder);
  const entry = ensureChild(group.entries, address.entry, createEntryBuilder);
  return address.subentry === undefined
    ? entry
    : ensureChild(entry.subentries, address.subentry, createSubentryBuilder);
}

export function insertLocator(entry: EntryBuilder | SubentryBuilder, locator: Locator): void {
  entry.locators.push(locator);
}

const xrefListKey = {
  preferred: "xrefPreferred",
  related: "xrefRelated",
} as const satisfies Record<XrefType, keyof SubentryBuilder>;

export function insertXref(
  entry: EntryBuilder | SubentryBuilder,
  type: XrefType,
  target: EntryAddress,
  template: string,
): void {
  entry[xrefListKey[type]].push({ target, template });
}

export function findUnresolvedXref(
  builder: IndexBuilder,
  target: EntryAddress,
): UnresolvedXref | undefined {
  const group = builder.groups.get(childKey(target.group));
  if (!group) {
    return { target, missing: "group" };
  }
  const entry = group.entries.get(childKey(target.entry));
  if (!entry) {
    return { target, missing: "entry" };
  }
  if (target.subentry !== undefined && !entry.subentries.has(childKey(target.subentry))) {
    return { target, missing: "subentry" };
  }
  return undefined;
}

export function labelInvalidXrefs(builder: IndexBuilder): ReadonlyMap<string, UnresolvedXref> {
  const unresolvedByTarget = new Map<string, UnresolvedXref>();
  const resolvedTargets = new Set<string>();
  const resolve = (target: EntryAddress): UnresolvedXref | undefined => {
    const targetKey = addressKey(target);
    if (resolvedTargets.has(targetKey)) {
      return undefined;
    }
    const known = unresolvedByTarget.get(targetKey);
    if (known !== undefined) {
      return known;
    }
    const unresolvedXref = findUnresolvedXref(builder, target);
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
  for (const group of builder.groups.values()) {
    for (const entry of group.entries.values()) {
      entry.xrefPreferred = entry.xrefPreferred.map(label);
      entry.xrefRelated = entry.xrefRelated.map(label);
      for (const subentry of entry.subentries.values()) {
        subentry.xrefPreferred = subentry.xrefPreferred.map(label);
        subentry.xrefRelated = subentry.xrefRelated.map(label);
      }
    }
  }
  return unresolvedByTarget;
}

const finalizeSubentry = (subentry: SubentryBuilder): Subentry => ({
  key: subentry.key,
  locators: [...subentry.locators],
  xrefPreferred: [...subentry.xrefPreferred],
  xrefRelated: [...subentry.xrefRelated],
});

export function finalizeIndex(builder: IndexBuilder): Index {
  return {
    groups: [...builder.groups.values()].map((group) => ({
      key: group.key,
      entries: [...group.entries.values()].map((entry) => ({
        ...finalizeSubentry(entry),
        subentries: [...entry.subentries.values()].map(finalizeSubentry),
      })),
    })),
  };
}
