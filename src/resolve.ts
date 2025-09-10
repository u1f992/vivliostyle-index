import {
  type Index,
  type HasKey,
  type ParentOf,
  type Reference,
  type Key,
  type ResolvedKey,
  type UnresolvedKey,
  getChild,
  hastChildrenToText,
} from "./model.js";

function resolveChildren<T extends HasKey<Key>>(
  parent: ParentOf<T>,
  mergeProps: Set<keyof Omit<T, "key">>,
) {
  const unresolved: HasKey<UnresolvedKey>[] = [];
  const resolved: HasKey<ResolvedKey>[] = [];

  for (const child of parent.children) {
    if (child.key[1] === null) {
      unresolved.push(child as HasKey<UnresolvedKey>);
    } else {
      resolved.push(child as HasKey<ResolvedKey>);
    }
  }

  for (const u of unresolved as T[]) {
    const existing = resolved.find(
      (item) =>
        hastChildrenToText(item.key[0]) === hastChildrenToText(u.key[0]),
    ) as T | undefined;
    if (existing) {
      for (const prop of mergeProps) {
        if (Array.isArray(existing[prop]) && Array.isArray(u[prop])) {
          (existing[prop] as unknown[]).push(...(u[prop] as unknown[]));
        }
      }
    } else {
      const r = u as HasKey<ResolvedKey>;
      r.key = [r.key[0], hastChildrenToText(r.key[0])];
      resolved.push(r);
    }
  }

  parent.children = resolved as T[];
}

function fillKey(key: Key) {
  key[1] = key[1] === null ? hastChildrenToText(key[0]) : key[1];
}

function resolveReferences(index: Index<Key>) {
  const references: [string, ...Reference<Key>][] = [];
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
        `index id=${index.id} does not contain group=[${groupKey[0]},${groupKey[1]}]. link will likely be invalid.`,
      );
      fillKey(groupKey);
      fillKey(mainEntryKey);
      if (subentryKey) {
        fillKey(subentryKey);
      }
      continue;
    }
    groupKey[1] = group.key[1];

    const mainEntry = getChild(group, mainEntryKey);
    if (!mainEntry) {
      console.warn(
        `index id=${index.id} does not contain group=[${groupKey[0]},${groupKey[1]}],mainEntry=[${mainEntryKey[0]},${mainEntryKey[1]}]. link will likely be invalid.`,
      );
      fillKey(mainEntryKey);
      if (subentryKey) {
        fillKey(subentryKey);
      }
      continue;
    }
    mainEntryKey[1] = mainEntry.key[1];

    if (subentryKey) {
      const subentry = getChild(mainEntry, subentryKey);
      if (!subentry) {
        console.warn(
          `index id=${index.id} does not contain group=[${groupKey[0]},${groupKey[1]}],mainEntry=[${mainEntryKey[0]},${mainEntryKey[1]}],subEntry=[${subentryKey[0]},${subentryKey[1]}]. link will likely be invalid.`,
        );
        fillKey(subentryKey);
        continue;
      }
      subentryKey[1] = subentry.key[1];
    }
  }
}

export function resolve(indexes: Index<Key>[]): Index<ResolvedKey>[] {
  const newIndexes = structuredClone(indexes);
  for (let i = 0; i < newIndexes.length; i++) {
    const index = newIndexes[i]!;
    resolveChildren(index, new Set(["children"]));

    for (let j = 0; j < index.children.length; j++) {
      const group = index.children[j]!;
      resolveChildren(
        group,
        new Set(["children", "locators", "see", "seeAlso"]),
      );

      for (let k = 0; k < group.children.length; k++) {
        resolveChildren(
          group.children[k]!,
          new Set(["locators", "see", "seeAlso"]),
        );
      }
    }
    resolveReferences(index);
  }
  return newIndexes as Index<ResolvedKey>[];
}
