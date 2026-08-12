import { type EntryBase, type Index, getChild } from "./model.ts";

export function validateReferences(index: Index): string[] {
  const diagnostics: string[] = [];
  const references: EntryBase["see"] = [];
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
  for (const { target } of references) {
    const { group: groupKey, mainEntry: mainEntryKey, subentry: subentryKey } = target;
    const group = getChild(index, groupKey);
    if (!group) {
      diagnostics.push(
        `index does not contain group=${JSON.stringify(groupKey)}. link will likely be invalid.`,
      );
      continue;
    }
    const mainEntry = getChild(group, mainEntryKey);
    if (!mainEntry) {
      diagnostics.push(
        `index does not contain group=${JSON.stringify(groupKey)},mainEntry=${JSON.stringify(mainEntryKey)}. link will likely be invalid.`,
      );
      continue;
    }
    if (subentryKey) {
      const subentry = getChild(mainEntry, subentryKey);
      if (!subentry) {
        diagnostics.push(
          `index does not contain group=${JSON.stringify(groupKey)},mainEntry=${JSON.stringify(mainEntryKey)},subEntry=${JSON.stringify(subentryKey)}. link will likely be invalid.`,
        );
      }
    }
  }
  return diagnostics;
}
