import { fragmentToText } from "./html.ts";
import type { Group, HasKey, Index, MainEntry, Subentry } from "./model.ts";

type Locator = MainEntry["locators"][0];
type Reference = MainEntry["see"][0];

type Comparator<T> = NonNullable<Parameters<Array<T>["sort"]>[0]>;
export type IndexComparator = {
  group: Comparator<Group>;
  mainEntry: Comparator<MainEntry>;
  mainEntryLocator: Comparator<Locator>;
  mainEntrySee: Comparator<Reference>;
  mainEntrySeeAlso: Comparator<Reference>;
  subentry: Comparator<Subentry>;
  subentryLocator: Comparator<Locator>;
  subentrySee: Comparator<Reference>;
  subentrySeeAlso: Comparator<Reference>;
};
export const byListedOrder: Comparator<Locator> & Comparator<Reference> = (a, b) =>
  a.sequence.localeCompare(b.sequence);

export function byLocales(
  locales: Intl.LocalesArgument,
): Comparator<HasKey> & Comparator<Reference> {
  const collator = new Intl.Collator(locales);
  const compareKeys = (a: HasKey["key"], b: HasKey["key"]) => {
    const readingCompare = collator.compare(a.reading, b.reading);
    return readingCompare !== 0
      ? readingCompare
      : collator.compare(fragmentToText(a.html), fragmentToText(b.html));
  };
  return function compare(a, b): ReturnType<Comparator<HasKey | Reference>> {
    if ("target" in a && "target" in b) {
      const groupKeyCompare = compareKeys(a.target.group, b.target.group);
      if (groupKeyCompare !== 0) {
        return groupKeyCompare;
      }
      const mainKeyCompare = compareKeys(a.target.mainEntry, b.target.mainEntry);
      if (mainKeyCompare !== 0) {
        return mainKeyCompare;
      }
      const aSubentry = a.target.subentry;
      const bSubentry = b.target.subentry;
      if (aSubentry !== undefined && bSubentry !== undefined) {
        return compareKeys(aSubentry, bSubentry);
      }
      if (aSubentry !== undefined && bSubentry === undefined) {
        return 1;
      } else if (aSubentry === undefined && bSubentry !== undefined) {
        return -1;
      } else {
        return 0;
      }
    } else if ("key" in a && "key" in b) {
      return compareKeys(a.key, b.key);
    }
    return 0;
  };
}

export function sort(index: Index, comparator: IndexComparator) {
  const sorted = structuredClone(index);
  sorted.children.sort(comparator.group);
  for (const group of sorted.children) {
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
  return sorted;
}
