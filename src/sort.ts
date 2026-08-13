import { fragmentToText } from "./html.ts";
import type { Entry, Group, HasKey, Index, Key, Reference, Subentry } from "./model.ts";
import type { Target } from "./target.ts";

type Comparator<T> = NonNullable<Parameters<Array<T>["sort"]>[0]>;
export type IndexComparator = {
  group: Comparator<Group>;
  entry: Comparator<Entry>;
  entrySee: Comparator<Reference>;
  entrySeeAlso: Comparator<Reference>;
  subentry: Comparator<Subentry>;
  subentrySee: Comparator<Reference>;
  subentrySeeAlso: Comparator<Reference>;
};

export type KeyComparator = Comparator<Key>;
export type CreateKeyComparator = (locales: Intl.LocalesArgument) => KeyComparator;
export type EntryComparator = Comparator<HasKey> & Comparator<Reference>;
export type CreateIndexComparator = (locales: Intl.LocalesArgument) => IndexComparator;

export type Comparators = readonly (readonly [Target, CreateIndexComparator])[];

function keysOf(value: HasKey | Reference): readonly Key[] {
  if (!("target" in value)) {
    return [value.key];
  }
  const { group, entry, subentry } = value.target;
  return subentry === undefined ? [group, entry] : [group, entry, subentry];
}

export function byKeys(compareKeys: KeyComparator): EntryComparator {
  return (a: HasKey | Reference, b: HasKey | Reference) => {
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

const listedKeyIdentity = (key: ListedKey): string =>
  typeof key === "string" ? JSON.stringify([key, key]) : JSON.stringify([key.html, key.reading]);

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

export function sort(index: Index, comparator: IndexComparator) {
  const sorted = structuredClone(index);
  sorted.children.sort(comparator.group);
  for (const group of sorted.children) {
    group.children.sort(comparator.entry);
    for (const entry of group.children) {
      entry.see.sort(comparator.entrySee);
      entry.seeAlso.sort(comparator.entrySeeAlso);
      entry.children.sort(comparator.subentry);
      for (const subentry of entry.children) {
        subentry.see.sort(comparator.subentrySee);
        subentry.seeAlso.sort(comparator.subentrySeeAlso);
      }
    }
  }
  return sorted;
}

export function defaultComparator(locales: Intl.LocalesArgument): IndexComparator {
  const compare = byKeys(byLocales(locales));
  return {
    group: compare,
    entry: compare,
    entrySee: compare,
    entrySeeAlso: compare,
    subentry: compare,
    subentrySee: compare,
    subentrySeeAlso: compare,
  };
}
