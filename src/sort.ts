import { fragmentToText } from "./html.ts";
import type { Entry, Group, HasKey, Index, Key, Subentry, Xref } from "./model.ts";

type Comparator<T> = NonNullable<Parameters<Array<T>["sort"]>[0]>;
export type IndexComparator = {
  group: Comparator<Group>;
  entry: Comparator<Entry>;
  entryXrefPreferred: Comparator<Xref>;
  entryXrefRelated: Comparator<Xref>;
  subentry: Comparator<Subentry>;
  subentryXrefPreferred: Comparator<Xref>;
  subentryXrefRelated: Comparator<Xref>;
};

export type KeyComparator = Comparator<Key>;
export type CreateKeyComparator = (locales: Intl.LocalesArgument) => KeyComparator;
export type EntryComparator = Comparator<HasKey> & Comparator<Xref>;
export type CreateIndexComparator = (locales: Intl.LocalesArgument) => IndexComparator;

function keysOf(value: HasKey | Xref): readonly Key[] {
  if (!("target" in value)) {
    return [value.key];
  }
  const { group, entry, subentry } = value.target;
  return subentry === undefined ? [group, entry] : [group, entry, subentry];
}

export function byKeys(compareKeys: KeyComparator): EntryComparator {
  return (a: HasKey | Xref, b: HasKey | Xref) => {
    const aKeys = keysOf(a);
    const bKeys = keysOf(b);
    for (let depth = 0; depth < Math.min(aKeys.length, bKeys.length); depth++) {
      const keyCompare = compareKeys(aKeys[depth]!, bKeys[depth]!);
      if (keyCompare !== 0) {
        return keyCompare;
      }
    }
    return aKeys.length - bKeys.length;
  };
}

export type ListedKey = string | Key;

const listedKeyIdentity = (key: ListedKey): string => {
  const { html, reading } = typeof key === "string" ? { html: key, reading: key } : key;
  return JSON.stringify([html.normalize("NFC"), reading.normalize("NFC")]);
};

export function byLocales(locales: Intl.LocalesArgument): KeyComparator {
  const collator = new Intl.Collator(locales);
  const htmlTexts = new Map<string, string>();
  const htmlText = (html: string): string => {
    const cached = htmlTexts.get(html);
    if (cached !== undefined) {
      return cached;
    }
    const text = fragmentToText(html);
    htmlTexts.set(html, text);
    return text;
  };
  return (a, b) => {
    const readingCompare = collator.compare(a.reading, b.reading);
    return readingCompare !== 0
      ? readingCompare
      : collator.compare(htmlText(a.html), htmlText(b.html));
  };
}

function listedKeyPositions(order: readonly ListedKey[]): ReadonlyMap<string, number> {
  const positions = new Map<string, number>();
  order.forEach((key, position) => {
    const identity = listedKeyIdentity(key);
    if (!positions.has(identity)) {
      positions.set(identity, position);
    }
  });
  return positions;
}

export function byListedOrder(
  order: readonly ListedKey[],
  fallback: CreateKeyComparator = byLocales,
): CreateKeyComparator {
  const positions = listedKeyPositions(order);
  return (locales) => {
    const compareUnlisted = fallback(locales);
    return (a, b) => {
      const aPosition = positions.get(listedKeyIdentity(a));
      const bPosition = positions.get(listedKeyIdentity(b));
      if (aPosition === undefined || bPosition === undefined) {
        return aPosition === bPosition ? compareUnlisted(a, b) : aPosition === undefined ? 1 : -1;
      }
      return aPosition - bPosition;
    };
  };
}

export function sort(index: Index, comparator: IndexComparator): Index {
  return {
    groups: index.groups.toSorted(comparator.group).map((group) => ({
      key: group.key,
      entries: group.entries.toSorted(comparator.entry).map((entry) => ({
        key: entry.key,
        locators: entry.locators,
        xrefPreferred: entry.xrefPreferred.toSorted(comparator.entryXrefPreferred),
        xrefRelated: entry.xrefRelated.toSorted(comparator.entryXrefRelated),
        subentries: entry.subentries.toSorted(comparator.subentry).map((subentry) => ({
          key: subentry.key,
          locators: subentry.locators,
          xrefPreferred: subentry.xrefPreferred.toSorted(comparator.subentryXrefPreferred),
          xrefRelated: subentry.xrefRelated.toSorted(comparator.subentryXrefRelated),
        })),
      })),
    })),
  };
}

export function defaultComparator(locales: Intl.LocalesArgument): IndexComparator {
  const compare = byKeys(byLocales(locales));
  return {
    group: compare,
    entry: compare,
    entryXrefPreferred: compare,
    entryXrefRelated: compare,
    subentry: compare,
    subentryXrefPreferred: compare,
    subentryXrefRelated: compare,
  };
}
