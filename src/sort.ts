import {
  hastChildrenToText,
  type Group,
  type HasKey,
  type Index,
  type IndexId,
  type MainEntry,
  type ResolvedKey,
  type Subentry,
} from "./model.js";

type Locator = MainEntry<ResolvedKey>["locators"][0];
type Reference = MainEntry<ResolvedKey>["see"][0];

type Comparator<T> = NonNullable<Parameters<Array<T>["sort"]>[0]>;
export type Comparators = Record<
  IndexId,
  {
    group: Comparator<Group<ResolvedKey>>;
    mainEntry: Comparator<MainEntry<ResolvedKey>>;
    mainEntryLocator: Comparator<Locator>;
    mainEntrySee: Comparator<Reference>;
    mainEntrySeeAlso: Comparator<Reference>;
    subentry: Comparator<Subentry<ResolvedKey>>;
    subentryLocator: Comparator<Locator>;
    subentrySee: Comparator<Reference>;
    subentrySeeAlso: Comparator<Reference>;
  }
>;

export const byListedOrder: Comparator<Locator> & Comparator<Reference> = (
  a,
  b,
) => a[0].localeCompare(b[0]);

export function byLocales(
  locales: Intl.LocalesArgument,
): Comparator<HasKey<ResolvedKey>> & Comparator<Reference> {
  const collator = new Intl.Collator(locales);
  return function self(
    a,
    b,
  ): ReturnType<Comparator<HasKey<ResolvedKey> | Reference>> {
    if (Array.isArray(a) && Array.isArray(b)) {
      const groupKeyCompare = self({ key: a[1] }, { key: b[1] });
      if (groupKeyCompare !== 0) {
        return groupKeyCompare;
      }
      const mainKeyCompare = self({ key: a[2] }, { key: b[2] });
      if (mainKeyCompare !== 0) {
        return mainKeyCompare;
      }
      if (a[3] && b[3]) {
        return self({ key: a[3] }, { key: b[3] });
      }
      if (a[3] && !b[3]) {
        return 1;
      } else if (!a[3] && b[3]) {
        return -1;
      } else {
        return 0;
      }
    } else if (!Array.isArray(a) && !Array.isArray(b)) {
      const key1Compare = collator.compare(a.key[1], b.key[1]);
      return key1Compare !== 0
        ? key1Compare
        : collator.compare(
            hastChildrenToText(a.key[0]),
            hastChildrenToText(b.key[0]),
          );
    }
    return 0;
  };
}

export function sort(indexes: Index<ResolvedKey>[], comparators: Comparators) {
  const newIndexes = structuredClone(indexes);
  for (const index of newIndexes) {
    const comparator = comparators[index.id];
    if (!comparator) {
      continue;
    }
    index.children.sort(comparator.group);
    for (const group of index.children) {
      group.children.sort(comparator.mainEntry);
      for (const mainEntry of group.children) {
        mainEntry.locators.sort(comparator.mainEntryLocator);
        mainEntry.see.sort(comparator.mainEntrySee);
        mainEntry.seeAlso.sort(comparator.mainEntrySeeAlso);
        mainEntry.children.sort(comparator.subentry);
        for (const subentry of mainEntry.children) {
          subentry.locators.sort(comparator.subentryLocator);
          subentry.see.sort(comparator.subentrySee);
          subentry.seeAlso.sort(comparator.subentrySeeAlso);
        }
      }
    }
  }
  return newIndexes;
}
