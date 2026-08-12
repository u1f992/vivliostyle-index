import { type Index, type Reference, getChild } from "./model.ts";

export function validateReferences(index: Index) {
  const references: [string, ...Reference][] = [];
  for (const group of index.children) {
    for (const mainEntry of group.children) {
      references.push(...mainEntry.see);
      references.push(...mainEntry.seeAlso);
      for (const subentry of mainEntry.children) {
        references.push(...subentry.see);
        references.push(...subentry.seeAlso);
      }
    }
  }
  for (const reference of references) {
    const [, groupKey, mainEntryKey, subentryKey] = reference;
    const group = getChild(index, groupKey);
    if (!group) {
      console.warn(
        `index does not contain group=[${groupKey[0]},${groupKey[1]}]. link will likely be invalid.`,
      );
      continue;
    }
    const mainEntry = getChild(group, mainEntryKey);
    if (!mainEntry) {
      console.warn(
        `index does not contain group=[${groupKey[0]},${groupKey[1]}],mainEntry=[${mainEntryKey[0]},${mainEntryKey[1]}]. link will likely be invalid.`,
      );
      continue;
    }
    if (subentryKey) {
      const subentry = getChild(mainEntry, subentryKey);
      if (!subentry) {
        console.warn(
          `index does not contain group=[${groupKey[0]},${groupKey[1]}],mainEntry=[${mainEntryKey[0]},${mainEntryKey[1]}],subEntry=[${subentryKey[0]},${subentryKey[1]}]. link will likely be invalid.`,
        );
        continue;
      }
    }
  }
}
